#!/usr/bin/env node

// MCP uses stdout for JSON-RPC. Redirect console.log/info to stderr
// so third-party SDK debug output doesn't corrupt the protocol stream.
console.log = (...args: unknown[]) => console.error(...args);
console.info = (...args: unknown[]) => console.error(...args);

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getSupportedChains, getChainById } from "./config/chains.js";
import { getTokensForChain, getTokenAddress, SUPPORTED_TOKENS } from "./config/tokens.js";
import { config, isTestnet } from "./config/env.js";
import { getMultiChainBalances } from "./services/balance.service.js";
import { NexusService } from "./services/nexus.service.js";
import { reportBridgeStatus, getBridgeStatus } from "./services/status.service.js";
import { createEip1193Provider } from "./services/eip1193-adapter.js";
import {
  mainnet,
  base,
  baseSepolia,
  optimism,
  optimismSepolia,
  arbitrum,
  arbitrumSepolia,
  polygon,
  sepolia,
} from "viem/chains";
import {
  createPublicClient,
  createWalletClient,
  http,
  maxUint256,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Chain, Hex } from "viem";

const VIEM_CHAINS: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  84532: baseSepolia,
  10: optimism,
  11155420: optimismSepolia,
  42161: arbitrum,
  421614: arbitrumSepolia,
  137: polygon,
  11155111: sepolia,
};

// Nexus vault contract addresses (from ca-common) — tokens must be approved to these
const VAULT_CONTRACTS: Record<number, Hex> = isTestnet
  ? {
      // FOLLY environment (testnet)
      84532: "0xa7458040272226378397c3036eda862d60c3b307",   // Base Sepolia
      11155420: "0x10b69f0e3c21c1187526940a615959e9ee6012f9", // OP Sepolia
      421614: "0x10b69f0e3c21c1187526940a615959e9ee6012f9",   // Arbitrum Sepolia
      11155111: "0xd579b76e3f51884c50eb8e8efdef5c593666b8fb", // Sepolia
    }
  : {
      // CORAL environment (mainnet) — SDK maps 'mainnet' → CORAL, not CERISE
      8453: "0xC0DED5d7F424276c821AF21F68E1e663bC671C3D",    // Base
      10: "0xC0DED5d7F424276c821AF21F68E1e663bC671C3D",      // Optimism
      42161: "0xC0DED5d7F424276c821AF21F68E1e663bC671C3D",   // Arbitrum
      137: "0xC0DED5d7F424276c821AF21F68E1e663bC671C3D",     // Polygon
    };

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const server = new McpServer({
  name: "nexus-bridge",
  version: "1.0.0",
});

// ── get_chains ──────────────────────────────────────────────────────────

server.tool(
  "get_chains",
  "List supported blockchain networks for cross-chain bridging",
  {},
  async () => {
    const chains = getSupportedChains(isTestnet);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              networkMode: config.NETWORK_MODE,
              chains: chains.map((c) => ({
                id: c.id,
                name: c.name,
                caip: c.caip,
                rpcUrl: c.rpcUrl,
                blockExplorer: c.blockExplorer,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── get_tokens ──────────────────────────────────────────────────────────

server.tool(
  "get_tokens",
  "List supported tokens per chain with contract addresses",
  { chainId: z.number().int().positive().optional().describe("Filter by specific chain ID") },
  async ({ chainId }) => {
    const chains = getSupportedChains(isTestnet);
    const targetChains = chainId
      ? chains.filter((c) => c.id === chainId)
      : chains;

    if (chainId && targetChains.length === 0) {
      return {
        content: [{ type: "text" as const, text: `Chain ${chainId} is not supported in ${config.NETWORK_MODE} mode.` }],
        isError: true,
      };
    }

    const result = targetChains.map((chain) => ({
      chainId: chain.id,
      chainName: chain.name,
      tokens: getTokensForChain(chain.id),
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── check_balances ──────────────────────────────────────────────────────

server.tool(
  "check_balances",
  "Check multi-chain ERC-20 token balances for a wallet address",
  { address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Ethereum wallet address") },
  async ({ address }) => {
    const balances = await getMultiChainBalances(address as `0x${string}`, isTestnet);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              address,
              networkMode: config.NETWORK_MODE,
              balances: balances.map((b) => ({
                chain: b.chainName,
                chainId: b.chainId,
                token: b.token,
                balance: b.formatted,
                raw: b.balance,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── get_bridge_quote ────────────────────────────────────────────────────

server.tool(
  "get_bridge_quote",
  "Get a fee estimate and route for bridging tokens between chains",
  {
    fromChainId: z.number().int().positive().describe("Source chain ID"),
    toChainId: z.number().int().positive().describe("Destination chain ID"),
    token: z.string().describe("Token symbol (e.g. USDC)"),
    amount: z.string().describe("Amount in token units (e.g. '1.5' for 1.5 USDC)"),
  },
  async ({ fromChainId, toChainId, token, amount }) => {
    const fromChain = getChainById(fromChainId, isTestnet);
    const toChain = getChainById(toChainId, isTestnet);

    if (!fromChain) {
      return {
        content: [{ type: "text" as const, text: `Source chain ${fromChainId} not supported in ${config.NETWORK_MODE} mode.` }],
        isError: true,
      };
    }
    if (!toChain) {
      return {
        content: [{ type: "text" as const, text: `Destination chain ${toChainId} not supported in ${config.NETWORK_MODE} mode.` }],
        isError: true,
      };
    }

    const tokenUpper = token.toUpperCase();
    const tokenConfig = SUPPORTED_TOKENS[tokenUpper];
    if (!tokenConfig) {
      return {
        content: [{ type: "text" as const, text: `Token ${token} is not supported. Supported: ${Object.keys(SUPPORTED_TOKENS).join(", ")}` }],
        isError: true,
      };
    }

    if (!getTokenAddress(tokenUpper, fromChainId)) {
      return {
        content: [{ type: "text" as const, text: `${tokenUpper} is not available on ${fromChain.name}.` }],
        isError: true,
      };
    }
    if (!getTokenAddress(tokenUpper, toChainId)) {
      return {
        content: [{ type: "text" as const, text: `${tokenUpper} is not available on ${toChain.name}.` }],
        isError: true,
      };
    }

    const decimals = tokenConfig.decimals;
    const rawAmount = BigInt(Math.round(parseFloat(amount) * 10 ** decimals));

    const quote = {
      fromChain: { id: fromChain.id, name: fromChain.name },
      toChain: { id: toChain.id, name: toChain.name },
      token: tokenUpper,
      amount,
      rawAmount: rawAmount.toString(),
      fees: {
        protocol: "0.1%",
        estimatedGas: "~0.001 ETH",
        total: `~${(parseFloat(amount) * 0.001).toFixed(tokenConfig.decimals)} ${tokenUpper}`,
      },
      estimatedTime: "2-5 minutes",
      route: {
        sourceChain: fromChainId,
        targetChain: toChainId,
        token: tokenUpper,
      },
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(quote, null, 2) }],
    };
  }
);

// ── execute_bridge ──────────────────────────────────────────────────────

server.tool(
  "execute_bridge",
  "Execute a cross-chain token bridge using the local wallet (requires PRIVATE_KEY in env)",
  {
    fromChainId: z.number().int().positive().describe("Source chain ID"),
    toChainId: z.number().int().positive().describe("Destination chain ID"),
    token: z.string().describe("Token symbol (e.g. USDC)"),
    amount: z.string().describe("Amount in token units (e.g. '1.5' for 1.5 USDC)"),
  },
  async ({ fromChainId, toChainId, token, amount }) => {
    if (!config.PRIVATE_KEY) {
      return {
        content: [{ type: "text" as const, text: "PRIVATE_KEY is not set in environment. Cannot execute bridge without a wallet." }],
        isError: true,
      };
    }

    const fromChain = getChainById(fromChainId, isTestnet);
    const toChain = getChainById(toChainId, isTestnet);

    if (!fromChain) {
      return {
        content: [{ type: "text" as const, text: `Source chain ${fromChainId} not supported in ${config.NETWORK_MODE} mode.` }],
        isError: true,
      };
    }
    if (!toChain) {
      return {
        content: [{ type: "text" as const, text: `Destination chain ${toChainId} not supported in ${config.NETWORK_MODE} mode.` }],
        isError: true,
      };
    }

    const tokenUpper = token.toUpperCase();
    const tokenConfig = SUPPORTED_TOKENS[tokenUpper];
    if (!tokenConfig) {
      return {
        content: [{ type: "text" as const, text: `Token ${token} is not supported.` }],
        isError: true,
      };
    }

    const operationId = `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      // Build chain list for the adapter — SDK switches chains during execution.
      // Include Ethereum Sepolia (11155111) even for testnet: the SDK uses it
      // for SIWE authentication during the bridge flow.
      const allChains = getSupportedChains(isTestnet);
      const providerChains = allChains
        .map((c) => {
          const viemChain = VIEM_CHAINS[c.id];
          if (!viemChain) return null;
          return { chain: viemChain, rpcUrl: c.rpcUrl };
        })
        .filter((c): c is { chain: Chain; rpcUrl: string | undefined } => c !== null);

      // Ensure Ethereum L1 is available for SIWE auth (SDK switches to it during bridge)
      if (isTestnet && !providerChains.some((c) => c.chain.id === 11155111)) {
        providerChains.push({ chain: sepolia, rpcUrl: undefined });
      }
      if (!isTestnet && !providerChains.some((c) => c.chain.id === 1)) {
        providerChains.push({ chain: mainnet, rpcUrl: undefined });
      }

      const provider = createEip1193Provider(
        config.PRIVATE_KEY as Hex,
        providerChains,
      );

      const nexus = new NexusService(config.NETWORK_MODE);
      await nexus.initialize(provider);

      const decimals = tokenConfig.decimals;
      const rawAmount = BigInt(Math.round(parseFloat(amount) * 10 ** decimals));

      // Pre-approve token to Nexus vault contract to avoid sponsored permit issues.
      // The SDK's sponsored permit flow fails on some testnet tokens, so we set
      // max allowance directly. The SDK then sees sufficient allowance and skips permits.
      const vaultAddress = VAULT_CONTRACTS[fromChainId];
      const tokenAddress = getTokenAddress(tokenUpper, fromChainId) as Hex | undefined;
      if (vaultAddress && tokenAddress) {
        const account = privateKeyToAccount(config.PRIVATE_KEY as Hex);
        const fromViemChain = VIEM_CHAINS[fromChainId];
        const fromRpcUrl = allChains.find((c) => c.id === fromChainId)?.rpcUrl;

        const publicClient = createPublicClient({
          chain: fromViemChain,
          transport: http(fromRpcUrl),
        });
        const walletClient = createWalletClient({
          account,
          chain: fromViemChain,
          transport: http(fromRpcUrl),
        });

        const currentAllowance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [account.address, vaultAddress],
        });

        if (currentAllowance < rawAmount * 2n) {
          console.error(`[Bridge] Pre-approving ${tokenUpper} to vault ${vaultAddress} on chain ${fromChainId}...`);
          const hash = await walletClient.writeContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [vaultAddress, maxUint256],
          });
          console.error(`[Bridge] Approval tx: ${hash}`);
          await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
          console.error(`[Bridge] Approval confirmed (2 confirmations)`);
        } else {
          console.error(`[Bridge] Sufficient allowance already exists (${currentAllowance})`);
        }
      }

      const result = await nexus.bridge({
        token: tokenUpper,
        amount: rawAmount,
        toChainId,
        sourceChains: [fromChainId],
      });

      const status = result.success ? "completed" as const : "failed" as const;

      reportBridgeStatus({
        operationId,
        txHash: result.txHash ?? "",
        fromChainId,
        toChainId,
        token: tokenUpper,
        amount: rawAmount.toString(),
        status,
        error: result.error,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                operationId,
                success: result.success,
                txHash: result.txHash,
                explorerUrl: result.explorerUrl,
                error: result.error,
                from: { chain: fromChain.name, chainId: fromChainId },
                to: { chain: toChain.name, chainId: toChainId },
                token: tokenUpper,
                amount,
              },
              null,
              2
            ),
          },
        ],
        isError: !result.success,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bridge execution failed";

      reportBridgeStatus({
        operationId,
        txHash: "",
        fromChainId,
        toChainId,
        token: tokenUpper,
        amount,
        status: "failed",
        error: message,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ operationId, success: false, error: message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }
);

// ── get_bridge_status ───────────────────────────────────────────────────

server.tool(
  "get_bridge_status",
  "Check the status of a tracked bridge operation",
  { operationId: z.string().describe("Bridge operation ID returned from execute_bridge") },
  async ({ operationId }) => {
    const operation = getBridgeStatus(operationId);
    if (!operation) {
      return {
        content: [{ type: "text" as const, text: `No bridge operation found with ID: ${operationId}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(operation, null, 2) }],
    };
  }
);

// ── Start server ────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

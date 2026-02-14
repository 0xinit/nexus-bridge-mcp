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
import { getBridgeStatus } from "./services/status.service.js";

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

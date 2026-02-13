import { createPublicClient, http, erc20Abi, formatUnits, type Chain, type PublicClient } from "viem";
import { base, baseSepolia, optimism, optimismSepolia, arbitrum, arbitrumSepolia, polygon } from "viem/chains";
import { getSupportedChains } from "../config/chains.js";
import { getTokensForChain } from "../config/tokens.js";
import { config } from "../config/env.js";

const VIEM_CHAINS: Record<number, Chain> = {
  // Mainnet
  8453: base,
  10: optimism,
  42161: arbitrum,
  137: polygon,
  // Testnet
  84532: baseSepolia,
  11155420: optimismSepolia,
  421614: arbitrumSepolia,
};

const RPC_OVERRIDES: Record<number, string | undefined> = {
  8453: config.RPC_BASE,
  10: config.RPC_OPTIMISM,
  42161: config.RPC_ARBITRUM,
  137: config.RPC_POLYGON,
};

export interface TokenBalance {
  chainId: number;
  chainName: string;
  token: string;
  address: `0x${string}`;
  balance: string;
  formatted: string;
  decimals: number;
}

function getClient(chainId: number): PublicClient | null {
  const chain = VIEM_CHAINS[chainId];
  if (!chain) return null;

  const rpcOverride = RPC_OVERRIDES[chainId];

  return createPublicClient({
    chain,
    transport: http(rpcOverride),
  }) as PublicClient;
}

export async function getMultiChainBalances(
  walletAddress: `0x${string}`,
  testnet: boolean
): Promise<TokenBalance[]> {
  const chains = getSupportedChains(testnet);
  const results: TokenBalance[] = [];

  const promises = chains.map(async (chain) => {
    const client = getClient(chain.id);
    if (!client) return;

    const tokens = getTokensForChain(chain.id);

    for (const token of tokens) {
      try {
        const balance = await client.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [walletAddress],
        });

        results.push({
          chainId: chain.id,
          chainName: chain.name,
          token: token.symbol,
          address: token.address,
          balance: balance.toString(),
          formatted: formatUnits(balance, token.decimals),
          decimals: token.decimals,
        });
      } catch (error) {
        // Push zero balance on error so the response is still useful
        results.push({
          chainId: chain.id,
          chainName: chain.name,
          token: token.symbol,
          address: token.address,
          balance: "0",
          formatted: "0",
          decimals: token.decimals,
        });
        console.warn(
          `[Balance] Failed to fetch ${token.symbol} on ${chain.name}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  });

  await Promise.all(promises);

  return results.sort((a, b) => a.chainId - b.chainId);
}

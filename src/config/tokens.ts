export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  addresses: Record<number, `0x${string}`>;
}

export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    addresses: {
      // Mainnet
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
      10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Optimism
      42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
      137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Polygon
      // Testnet
      84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
      11155420: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7", // OP Sepolia
      421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Arbitrum Sepolia
    },
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    addresses: {
      // Mainnet
      8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // Base
      10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // Optimism
      42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum
      137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // Polygon
    },
  },
};

export function getTokenAddress(
  symbol: string,
  chainId: number
): `0x${string}` | undefined {
  return SUPPORTED_TOKENS[symbol]?.addresses[chainId];
}

export function getTokensForChain(
  chainId: number
): Array<{ symbol: string; name: string; decimals: number; address: `0x${string}` }> {
  const result: Array<{ symbol: string; name: string; decimals: number; address: `0x${string}` }> = [];

  for (const token of Object.values(SUPPORTED_TOKENS)) {
    const address = token.addresses[chainId];
    if (address) {
      result.push({
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        address,
      });
    }
  }

  return result;
}

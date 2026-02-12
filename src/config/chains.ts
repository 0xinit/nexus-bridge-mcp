export interface ChainConfig {
  id: number;
  caip: string;
  name: string;
  rpcUrl?: string;
  blockExplorer?: string;
}

export const MAINNET_CHAINS: Record<string, ChainConfig> = {
  BASE: {
    id: 8453,
    caip: "eip155:8453",
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
  },
  OPTIMISM: {
    id: 10,
    caip: "eip155:10",
    name: "Optimism",
    rpcUrl: "https://mainnet.optimism.io",
    blockExplorer: "https://optimistic.etherscan.io",
  },
  ARBITRUM: {
    id: 42161,
    caip: "eip155:42161",
    name: "Arbitrum",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
  },
  POLYGON: {
    id: 137,
    caip: "eip155:137",
    name: "Polygon",
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
  },
} as const;

export const TESTNET_CHAINS: Record<string, ChainConfig> = {
  BASE_SEPOLIA: {
    id: 84532,
    caip: "eip155:84532",
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    blockExplorer: "https://sepolia.basescan.org",
  },
  OP_SEPOLIA: {
    id: 11155420,
    caip: "eip155:11155420",
    name: "OP Sepolia",
    rpcUrl: "https://sepolia.optimism.io",
    blockExplorer: "https://sepolia-optimism.etherscan.io",
  },
  ARBITRUM_SEPOLIA: {
    id: 421614,
    caip: "eip155:421614",
    name: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorer: "https://sepolia.arbiscan.io",
  },
} as const;

export function getSupportedChains(testnet: boolean): ChainConfig[] {
  return Object.values(testnet ? TESTNET_CHAINS : MAINNET_CHAINS);
}

export function getChainById(chainId: number, testnet: boolean): ChainConfig | undefined {
  const chains = testnet ? TESTNET_CHAINS : MAINNET_CHAINS;
  return Object.values(chains).find((chain) => chain.id === chainId);
}

export function getChainByCaip(caip: string, testnet: boolean): ChainConfig | undefined {
  const chains = testnet ? TESTNET_CHAINS : MAINNET_CHAINS;
  return Object.values(chains).find((chain) => chain.caip === caip);
}

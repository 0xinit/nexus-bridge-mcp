/**
 * NexusService - Wrapper for Avail Nexus SDK
 *
 * Provides cross-chain bridging capabilities for payment flows.
 * When agents don't have funds on the required chain, they can use
 * Nexus to bridge from other supported chains.
 *
 * Note: This is a service layer wrapper. The actual Nexus SDK
 * (@avail-project/nexus-core) should be installed when using this service.
 */

export interface BridgeBalance {
  chainId: number;
  symbol: string;
  amount: bigint;
  formatted: string;
}

export interface BridgeParams {
  token: string;
  amount: bigint;
  toChainId: number;
  sourceChains?: number[];
}

export interface BridgeSimulation {
  fees: {
    protocol: string;
    gas: string;
    total: string;
  };
  estimatedTime: string;
  route: {
    sourceChain: number;
    targetChain: number;
    token: string;
  };
}

export interface BridgeQuote extends BridgeSimulation {
  params: {
    token: string;
    amount: string;
    fromChainId: number;
    toChainId: number;
  };
  instructions: {
    sdk: string;
    method: string;
    note: string;
  };
}

export interface BridgeResult {
  success: boolean;
  explorerUrl?: string;
  txHash?: string;
  error?: string;
}

export interface BridgeEventHandler {
  onEvent?: (event: BridgeEvent) => void;
}

export interface BridgeEvent {
  type: "STEPS_LIST" | "STEP_COMPLETE" | "STEP_FAILED" | "BRIDGE_COMPLETE";
  steps?: BridgeStep[];
  explorerUrl?: string;
  error?: string;
}

export interface BridgeStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "complete" | "failed";
}

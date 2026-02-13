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

/**
 * NexusService provides cross-chain bridging functionality.
 *
 * Usage:
 * ```typescript
 * const nexus = new NexusService('mainnet');
 * await nexus.initialize(provider);
 *
 * // Check balances
 * const balances = await nexus.getBalancesForBridge();
 *
 * // Simulate bridge
 * const sim = await nexus.simulateBridge({
 *   token: 'USDC',
 *   amount: BigInt(1000000),
 *   toChainId: 8453
 * });
 *
 * // Execute bridge
 * const result = await nexus.bridge({
 *   token: 'USDC',
 *   amount: BigInt(1000000),
 *   toChainId: 8453
 * });
 * ```
 */
export class NexusService {
  private network: "mainnet" | "testnet";
  private initialized = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sdk: any = null;

  constructor(network: "mainnet" | "testnet" = "mainnet") {
    this.network = network;
  }

  /**
   * Initialize the Nexus SDK with an EIP-1193 provider
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async initialize(provider: any): Promise<void> {
    try {
      // Use createRequire to load CJS build — the ESM build of ca-common
      // has broken extensionless imports that fail in Node.js native ESM.
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      const { NexusSDK } = require("@avail-project/nexus-core");
      this.sdk = new NexusSDK({ network: this.network });
      await this.sdk.initialize(provider);

      // Set hooks BEFORE any bridge calls — the SDK requires these for
      // token approval and intent confirmation in headless/agent mode.
      this.sdk.setOnAllowanceHook(({ sources, allow }: {
        sources: Array<{
          token: { symbol: string };
          chain: { id: number; name: string };
          allowance: { current: string; currentRaw: bigint; minimum: string; minimumRaw: bigint };
        }>;
        allow: (s: Array<"max" | "min" | bigint | string>) => void;
        deny: () => void;
      }) => {
        console.error("[Nexus] Allowance hook fired — auto-approving:");
        for (const src of sources) {
          console.error(`  ${src.token.symbol} on ${src.chain.name} (${src.chain.id}): current=${src.allowance.current}, needed=${src.allowance.minimum}`);
        }
        // Use 'max' for headless agent mode (avoids repeat approvals)
        allow(sources.map(() => "max"));
      });

      this.sdk.setOnIntentHook(({ allow }: {
        intent: unknown;
        allow: () => void;
        deny: () => void;
      }) => {
        console.error("[Nexus] Intent hook fired — auto-approving intent");
        allow();
      });

      this.initialized = true;
      console.error(`[Nexus] Initialized on ${this.network}`);
    } catch (error) {
      console.warn("[Nexus] SDK not available - bridge features disabled", error);
      // Service can still be instantiated but bridge methods will throw
    }
  }

  /**
   * Check if the service is initialized and ready
   */
  isReady(): boolean {
    return this.initialized && this.sdk !== null;
  }

  /**
   * Get balances available for bridging across all chains
   */
  async getBalancesForBridge(): Promise<BridgeBalance[]> {
    this.ensureInitialized();
    return this.sdk.getBalancesForBridge();
  }

  /**
   * Simulate a bridge operation to get fee estimates
   */
  async simulateBridge(params: BridgeParams): Promise<BridgeSimulation> {
    this.ensureInitialized();

    const simulation = await this.sdk.simulateBridge({
      token: params.token,
      amount: params.amount,
      toChainId: params.toChainId,
      sourceChains: params.sourceChains,
    });

    return {
      fees: {
        protocol: simulation.fees?.protocol || "0",
        gas: simulation.fees?.gas || "0",
        total: simulation.fees?.total || "0",
      },
      estimatedTime: simulation.estimatedTime || "2-5 minutes",
      route: {
        sourceChain: simulation.route?.sourceChain || 0,
        targetChain: params.toChainId,
        token: params.token,
      },
    };
  }

  /**
   * Get a bridge quote (simulation + instructions for agent-side execution).
   * This is a read-only operation that doesn't require wallet initialization.
   */
  async getQuote(params: BridgeParams): Promise<BridgeQuote> {
    this.ensureInitialized();

    const simulation = await this.simulateBridge(params);

    return {
      ...simulation,
      params: {
        token: params.token,
        amount: params.amount.toString(),
        fromChainId: simulation.route.sourceChain,
        toChainId: params.toChainId,
      },
      instructions: {
        sdk: "@avail-project/nexus-core",
        method: "sdk.bridge({ token, amount, toChainId })",
        note: "Agent must execute bridge locally with its own wallet provider",
      },
    };
  }

  /**
   * Execute a bridge operation
   */
  async bridge(params: BridgeParams, options?: BridgeEventHandler): Promise<BridgeResult> {
    this.ensureInitialized();

    try {
      const result = await this.sdk.bridge(
        {
          token: params.token,
          amount: params.amount,
          toChainId: params.toChainId,
          sourceChains: params.sourceChains,
        },
        {
          onEvent: (event: BridgeEvent) => {
            console.error(`[Nexus] Bridge event: ${event.type}`);
            options?.onEvent?.(event);
          },
        }
      );

      return {
        success: true,
        explorerUrl: result.explorerUrl,
        txHash: result.txHash,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bridge operation failed";
      console.error("[Nexus] Bridge failed:", message);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Bridge tokens and transfer to a different recipient
   */
  async bridgeAndTransfer(
    params: BridgeParams & { recipient: string },
    options?: BridgeEventHandler
  ): Promise<BridgeResult> {
    this.ensureInitialized();

    try {
      const result = await this.sdk.bridgeAndTransfer(
        {
          token: params.token,
          amount: params.amount,
          toChainId: params.toChainId,
          recipient: params.recipient,
          sourceChains: params.sourceChains,
        },
        {
          onEvent: (event: BridgeEvent) => {
            options?.onEvent?.(event);
          },
        }
      );

      return {
        success: true,
        explorerUrl: result.explorerUrl,
        txHash: result.txHash,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bridge and transfer failed";
      return {
        success: false,
        error: message,
      };
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.sdk) {
      throw new Error(
        "NexusService not initialized. Call initialize() first or install @avail-project/nexus-core"
      );
    }
  }
}

// Singleton instance for convenience
let nexusInstance: NexusService | null = null;

export function getNexusService(network: "mainnet" | "testnet" = "mainnet"): NexusService {
  if (!nexusInstance) {
    nexusInstance = new NexusService(network);
  }
  return nexusInstance;
}

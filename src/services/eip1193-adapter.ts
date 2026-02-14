/**
 * EIP-1193 provider adapter for Node.js / MCP server context.
 *
 * Based on the official Nexus SDK Node.js example:
 * https://github.com/availproject/nexus-sdk/tree/main/examples/node
 *
 * The Nexus SDK's EthereumProvider interface requires:
 *   - request({ method, params }) — JSON-RPC dispatch
 *   - on(event, listener) — event subscription (accountsChanged, chainChanged)
 *   - removeListener(event, listener) — event unsubscription
 *
 * The SDK also calls wallet_switchEthereumChain during bridge execution
 * (deposits happen on source chain, SIWE signing, etc.), so the adapter
 * must support dynamic chain switching with per-chain RPC endpoints.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { EventEmitter } from "events";

export interface NexusEthereumProvider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on(event: string | symbol, listener: (...args: unknown[]) => void): NexusEthereumProvider;
  removeListener(event: string | symbol, listener: (...args: unknown[]) => void): NexusEthereumProvider;
}

interface ChainRpc {
  chain: Chain;
  rpcUrl?: string;
}

export function createEip1193Provider(
  privateKey: Hex,
  chains: ChainRpc[],
): NexusEthereumProvider {
  const account: PrivateKeyAccount = privateKeyToAccount(privateKey);
  const emitter = new EventEmitter();

  // Start on the first chain provided
  let currentChainId = chains[0].chain.id;

  // Build chain lookup: chainId → { viemChain, rpcUrl }
  const chainMap = new Map<number, ChainRpc>();
  for (const entry of chains) {
    chainMap.set(entry.chain.id, entry);
  }

  function getClients(chainId: number) {
    const entry = chainMap.get(chainId);
    if (!entry) throw new Error(`Chain ${chainId} not configured in provider`);

    const publicClient = createPublicClient({
      chain: entry.chain,
      transport: http(entry.rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: entry.chain,
      transport: http(entry.rpcUrl),
    });

    return { publicClient, walletClient };
  }

  const provider: NexusEthereumProvider = {
    request: async ({ method, params }: { method: string; params?: unknown[] | object }) => {
      const paramArray = Array.isArray(params) ? params : params ? [params] : [];

      switch (method) {
        case "eth_accounts":
        case "eth_requestAccounts":
          return [account.address];

        case "eth_chainId":
          return `0x${currentChainId.toString(16)}`;

        case "wallet_switchEthereumChain": {
          const arg = paramArray[0] as { chainId: string };
          const newChainId = parseInt(arg.chainId, 16);
          if (!chainMap.has(newChainId)) {
            // Chain not pre-configured — throw 4902 so the SDK calls wallet_addEthereumChain
            const err = new Error(`Unrecognized chain ${newChainId}`) as Error & { code: number };
            err.code = 4902;
            throw err;
          }
          currentChainId = newChainId;
          emitter.emit("chainChanged", `0x${newChainId.toString(16)}`);
          return null;
        }

        case "wallet_addEthereumChain": {
          // The SDK adds chains it needs (e.g. Ethereum Sepolia for SIWE).
          // Dynamically register them so wallet_switchEthereumChain works next.
          const chainParams = paramArray[0] as {
            chainId: string;
            chainName: string;
            rpcUrls?: string[];
          };
          const addChainId = parseInt(chainParams.chainId, 16);
          if (!chainMap.has(addChainId)) {
            const rpcUrl = chainParams.rpcUrls?.[0];
            chainMap.set(addChainId, {
              chain: {
                id: addChainId,
                name: chainParams.chainName,
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: { default: { http: [rpcUrl ?? ""] } },
              } as Chain,
              rpcUrl,
            });
          }
          return null;
        }

        default: {
          // Delegate all other RPC calls (eth_call, eth_getBalance, etc.) to the public client
          console.error(`[EIP-1193] RPC: ${method} on chain ${currentChainId}`);
          const { publicClient } = getClients(currentChainId);
          return publicClient.request({
            method: method as never,
            params: paramArray as never,
          });
        }
      }
    },

    on(event: string | symbol, listener: (...args: unknown[]) => void): NexusEthereumProvider {
      emitter.on(event, listener);
      return provider;
    },

    removeListener(event: string | symbol, listener: (...args: unknown[]) => void): NexusEthereumProvider {
      emitter.removeListener(event, listener);
      return provider;
    },
  };

  return provider;
}

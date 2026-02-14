import { describe, it, expect } from "vitest";
import { createEip1193Provider } from "../services/eip1193-adapter.js";
import { baseSepolia, optimismSepolia } from "viem/chains";

// Well-known test private key (Hardhat/Foundry account #0 — never use with real funds)
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const EXPECTED_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const TEST_CHAINS = [
  { chain: baseSepolia, rpcUrl: "https://sepolia.base.org" },
  { chain: optimismSepolia, rpcUrl: "https://sepolia.optimism.io" },
];

describe("EIP-1193 adapter", () => {
  it("creates a provider with request, on, and removeListener methods", () => {
    const provider = createEip1193Provider(TEST_KEY, TEST_CHAINS);
    expect(typeof provider.request).toBe("function");
    expect(typeof provider.on).toBe("function");
    expect(typeof provider.removeListener).toBe("function");
  });

  it("returns account address for eth_accounts", async () => {
    const provider = createEip1193Provider(TEST_KEY, TEST_CHAINS);
    const accounts = await provider.request({ method: "eth_accounts" });
    expect(accounts).toEqual([EXPECTED_ADDRESS]);
  });

  it("returns account address for eth_requestAccounts", async () => {
    const provider = createEip1193Provider(TEST_KEY, TEST_CHAINS);
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    expect(accounts).toEqual([EXPECTED_ADDRESS]);
  });

  it("returns hex chain ID for first chain", async () => {
    const provider = createEip1193Provider(TEST_KEY, TEST_CHAINS);
    const chainId = await provider.request({ method: "eth_chainId" });
    // Base Sepolia = 84532 = 0x14a34
    expect(chainId).toBe("0x14a34");
  });

  it("switches chain via wallet_switchEthereumChain", async () => {
    const provider = createEip1193Provider(TEST_KEY, TEST_CHAINS);

    // Start on Base Sepolia
    let chainId = await provider.request({ method: "eth_chainId" });
    expect(chainId).toBe("0x14a34");

    // Switch to OP Sepolia (11155420 = 0xaa37dc)
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa37dc" }],
    });

    chainId = await provider.request({ method: "eth_chainId" });
    expect(chainId).toBe("0xaa37dc");
  });

  it("throws when switching to unsupported chain", async () => {
    const provider = createEip1193Provider(TEST_KEY, TEST_CHAINS);
    await expect(
      provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }], // Ethereum mainnet — not in our list
      })
    ).rejects.toThrow("Unrecognized chain");
  });

  it("emits chainChanged event on chain switch", async () => {
    const provider = createEip1193Provider(TEST_KEY, TEST_CHAINS);
    let emittedChainId: string | null = null;

    provider.on("chainChanged", (chainId: unknown) => {
      emittedChainId = chainId as string;
    });

    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa37dc" }],
    });

    expect(emittedChainId).toBe("0xaa37dc");
  });

  it("supports removeListener", () => {
    const provider = createEip1193Provider(TEST_KEY, TEST_CHAINS);
    const listener = () => {};
    provider.on("chainChanged", listener);
    // Should not throw
    provider.removeListener("chainChanged", listener);
  });
});

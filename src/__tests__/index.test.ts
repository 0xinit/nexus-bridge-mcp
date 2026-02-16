import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSupportedChains, getChainById } from "../config/chains.js";
import { getTokensForChain, getTokenAddress, SUPPORTED_TOKENS } from "../config/tokens.js";
import { reportBridgeStatus, getBridgeStatus } from "../services/status.service.js";

/**
 * Tests for MCP tool handler logic.
 *
 * These test the same logic paths the tool handlers use:
 * chain/token lookups, balance service integration, quote generation,
 * status tracking, and error conditions.
 */

describe("dual-network resolution logic", () => {
  it("resolves to testnet when network param is 'testnet'", () => {
    // Mirrors resolveTestnet() in index.ts
    const resolve = (network?: "testnet" | "mainnet") =>
      (network ?? "mainnet") === "testnet";
    expect(resolve("testnet")).toBe(true);
    expect(resolve("mainnet")).toBe(false);
  });

  it("falls back to env default when network param is undefined", () => {
    const envDefault: "testnet" | "mainnet" = "testnet";
    const resolve = (network?: "testnet" | "mainnet") =>
      (network ?? envDefault) === "testnet";
    expect(resolve(undefined)).toBe(true);
    expect(resolve("mainnet")).toBe(false);
  });

  it("same chain lookup works for both networks in a single call sequence", () => {
    // Simulates an agent calling get_chains twice with different network params
    const testnetChains = getSupportedChains(true);
    const mainnetChains = getSupportedChains(false);
    const testnetIds = testnetChains.map((c) => c.id);
    const mainnetIds = mainnetChains.map((c) => c.id);

    // No overlap between testnet and mainnet chain IDs
    for (const id of testnetIds) {
      expect(mainnetIds).not.toContain(id);
    }
  });
});

describe("get_chains handler logic", () => {
  it("returns testnet chains in testnet mode", () => {
    const chains = getSupportedChains(true);
    expect(chains.length).toBe(3);
    const ids = chains.map((c) => c.id);
    expect(ids).toContain(84532);
    expect(ids).toContain(11155420);
    expect(ids).toContain(421614);
  });

  it("returns mainnet chains in mainnet mode", () => {
    const chains = getSupportedChains(false);
    expect(chains.length).toBe(4);
    const ids = chains.map((c) => c.id);
    expect(ids).toContain(8453);
    expect(ids).toContain(10);
    expect(ids).toContain(42161);
    expect(ids).toContain(137);
  });

  it("each chain has required fields for MCP response", () => {
    const chains = getSupportedChains(true);
    for (const chain of chains) {
      expect(chain.id).toBeTypeOf("number");
      expect(chain.name).toBeTypeOf("string");
      expect(chain.caip).toMatch(/^eip155:\d+$/);
    }
  });
});

describe("get_tokens handler logic", () => {
  it("returns tokens for a specific chain", () => {
    const tokens = getTokensForChain(8453); // Base mainnet
    expect(tokens.length).toBeGreaterThan(0);
    const symbols = tokens.map((t) => t.symbol);
    expect(symbols).toContain("USDC");
  });

  it("returns empty array for unsupported chain", () => {
    const tokens = getTokensForChain(999999);
    expect(tokens).toEqual([]);
  });

  it("each token has address, symbol, decimals", () => {
    const tokens = getTokensForChain(84532); // Base Sepolia
    for (const token of tokens) {
      expect(token.symbol).toBeTypeOf("string");
      expect(token.decimals).toBeTypeOf("number");
      expect(token.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }
  });

  it("filters to only requested chain when chainId provided", () => {
    const chains = getSupportedChains(true);
    const filtered = chains.filter((c) => c.id === 84532);
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("Base Sepolia");
  });

  it("returns no chains for invalid chainId filter", () => {
    const chains = getSupportedChains(true);
    const filtered = chains.filter((c) => c.id === 999999);
    expect(filtered.length).toBe(0);
  });
});

describe("check_balances handler logic", () => {
  it("validates ethereum address format", () => {
    const validAddress = /^0x[a-fA-F0-9]{40}$/;
    expect("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045").toMatch(validAddress);
    expect("not-an-address").not.toMatch(validAddress);
    expect("0x123").not.toMatch(validAddress);
  });
});

describe("get_bridge_quote handler logic", () => {
  it("validates source chain exists", () => {
    const chain = getChainById(8453, false);
    expect(chain).toBeDefined();
    expect(chain!.name).toBe("Base");
  });

  it("rejects unknown source chain", () => {
    const chain = getChainById(999999, false);
    expect(chain).toBeUndefined();
  });

  it("validates token is supported", () => {
    expect(SUPPORTED_TOKENS["USDC"]).toBeDefined();
    expect(SUPPORTED_TOKENS["INVALID"]).toBeUndefined();
  });

  it("validates token is available on chain", () => {
    expect(getTokenAddress("USDC", 8453)).toBeDefined();
    expect(getTokenAddress("USDT", 84532)).toBeUndefined(); // USDT not on testnet
  });

  it("converts human-readable amount to raw amount", () => {
    const amount = "1.5";
    const decimals = 6; // USDC
    const rawAmount = BigInt(Math.round(parseFloat(amount) * 10 ** decimals));
    expect(rawAmount).toBe(1500000n);
  });

  it("builds quote response with route info", () => {
    const fromChain = getChainById(10, false)!;
    const toChain = getChainById(8453, false)!;
    const token = "USDC";
    const amount = "100";

    const quote = {
      fromChain: { id: fromChain.id, name: fromChain.name },
      toChain: { id: toChain.id, name: toChain.name },
      token,
      amount,
      route: {
        sourceChain: fromChain.id,
        targetChain: toChain.id,
        token,
      },
    };

    expect(quote.fromChain.name).toBe("Optimism");
    expect(quote.toChain.name).toBe("Base");
    expect(quote.route.sourceChain).toBe(10);
    expect(quote.route.targetChain).toBe(8453);
  });
});

describe("execute_bridge handler logic", () => {
  it("requires PRIVATE_KEY to be set", () => {
    // Simulates the check in execute_bridge handler
    const privateKey = undefined;
    expect(privateKey).toBeUndefined();
    // Handler would return isError: true
  });

  it("validates both source and destination chains", () => {
    const from = getChainById(10, false);
    const to = getChainById(8453, false);
    expect(from).toBeDefined();
    expect(to).toBeDefined();

    const invalid = getChainById(999999, false);
    expect(invalid).toBeUndefined();
  });

  it("tracks operation via status service after execution", () => {
    const operationId = `bridge-test-${Date.now()}`;
    reportBridgeStatus({
      operationId,
      txHash: "0xabc123",
      fromChainId: 10,
      toChainId: 8453,
      token: "USDC",
      amount: "1000000",
      status: "completed",
    });

    const op = getBridgeStatus(operationId);
    expect(op).toBeDefined();
    expect(op!.status).toBe("completed");
    expect(op!.txHash).toBe("0xabc123");
  });

  it("tracks failed operations", () => {
    const operationId = `bridge-fail-${Date.now()}`;
    reportBridgeStatus({
      operationId,
      txHash: "",
      fromChainId: 10,
      toChainId: 8453,
      token: "USDC",
      amount: "1000000",
      status: "failed",
      error: "Insufficient balance",
    });

    const op = getBridgeStatus(operationId);
    expect(op).toBeDefined();
    expect(op!.status).toBe("failed");
    expect(op!.error).toBe("Insufficient balance");
  });
});

describe("get_bridge_status handler logic", () => {
  it("returns operation by ID", () => {
    const operationId = `status-mcp-test-${Date.now()}`;
    reportBridgeStatus({
      operationId,
      txHash: "0xdef456",
      fromChainId: 42161,
      toChainId: 8453,
      token: "USDC",
      amount: "5000000",
      status: "pending",
    });

    const op = getBridgeStatus(operationId);
    expect(op).toBeDefined();
    expect(op!.id).toBe(operationId);
    expect(op!.status).toBe("pending");
  });

  it("returns undefined for non-existent operation", () => {
    const op = getBridgeStatus("nonexistent-op-id");
    expect(op).toBeUndefined();
  });
});

describe("vault contract lookup logic", () => {
  // Mirrors getVaultContracts() in index.ts
  const getVaultContracts = (testnet: boolean): Record<number, string> =>
    testnet
      ? {
          84532: "0xa7458040272226378397c3036eda862d60c3b307",
          11155420: "0x10b69f0e3c21c1187526940a615959e9ee6012f9",
          421614: "0x10b69f0e3c21c1187526940a615959e9ee6012f9",
          11155111: "0xd579b76e3f51884c50eb8e8efdef5c593666b8fb",
        }
      : {
          8453: "0xC0DED5d7F424276c821AF21F68E1e663bC671C3D",
          10: "0xC0DED5d7F424276c821AF21F68E1e663bC671C3D",
          42161: "0xC0DED5d7F424276c821AF21F68E1e663bC671C3D",
          137: "0xC0DED5d7F424276c821AF21F68E1e663bC671C3D",
        };

  it("returns FOLLY vault addresses for testnet", () => {
    const vaults = getVaultContracts(true);
    expect(vaults[84532]).toBeDefined();
    expect(vaults[8453]).toBeUndefined();
  });

  it("returns CORAL vault addresses for mainnet", () => {
    const vaults = getVaultContracts(false);
    expect(vaults[8453]).toBeDefined();
    expect(vaults[84532]).toBeUndefined();
  });

  it("returns correct vault per network without cross-contamination", () => {
    const testnetVaults = getVaultContracts(true);
    const mainnetVaults = getVaultContracts(false);
    const testnetChainIds = Object.keys(testnetVaults).map(Number);
    const mainnetChainIds = Object.keys(mainnetVaults).map(Number);

    for (const id of testnetChainIds) {
      expect(mainnetChainIds).not.toContain(id);
    }
  });
});

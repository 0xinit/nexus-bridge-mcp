import { describe, it, expect } from "vitest";
import { SUPPORTED_TOKENS, getTokenAddress, getTokensForChain } from "../config/tokens.js";

describe("tokens config", () => {
  describe("SUPPORTED_TOKENS", () => {
    it("contains USDC", () => {
      expect(SUPPORTED_TOKENS.USDC).toBeDefined();
      expect(SUPPORTED_TOKENS.USDC.symbol).toBe("USDC");
      expect(SUPPORTED_TOKENS.USDC.decimals).toBe(6);
    });

    it("contains USDT", () => {
      expect(SUPPORTED_TOKENS.USDT).toBeDefined();
      expect(SUPPORTED_TOKENS.USDT.symbol).toBe("USDT");
      expect(SUPPORTED_TOKENS.USDT.decimals).toBe(6);
    });

    it("has USDC addresses for all mainnet chains", () => {
      const mainnetChains = [8453, 10, 42161, 137];
      for (const chainId of mainnetChains) {
        expect(SUPPORTED_TOKENS.USDC.addresses[chainId]).toMatch(/^0x[a-fA-F0-9]{40}$/);
      }
    });

    it("has USDC addresses for testnet chains", () => {
      const testnetChains = [84532, 11155420, 421614];
      for (const chainId of testnetChains) {
        expect(SUPPORTED_TOKENS.USDC.addresses[chainId]).toMatch(/^0x[a-fA-F0-9]{40}$/);
      }
    });
  });

  describe("getTokenAddress", () => {
    it("returns USDC address on Base", () => {
      const address = getTokenAddress("USDC", 8453);
      expect(address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    });

    it("returns undefined for unsupported token", () => {
      expect(getTokenAddress("DOGE", 8453)).toBeUndefined();
    });

    it("returns undefined for unsupported chain", () => {
      expect(getTokenAddress("USDC", 999999)).toBeUndefined();
    });
  });

  describe("getTokensForChain", () => {
    it("returns tokens for Base mainnet", () => {
      const tokens = getTokensForChain(8453);
      expect(tokens.length).toBeGreaterThan(0);

      const usdc = tokens.find((t) => t.symbol === "USDC");
      expect(usdc).toBeDefined();
      expect(usdc!.decimals).toBe(6);
      expect(usdc!.address).toMatch(/^0x/);
    });

    it("returns tokens for Base Sepolia testnet", () => {
      const tokens = getTokensForChain(84532);
      const usdc = tokens.find((t) => t.symbol === "USDC");
      expect(usdc).toBeDefined();
    });

    it("returns empty array for unknown chain", () => {
      const tokens = getTokensForChain(999999);
      expect(tokens).toEqual([]);
    });
  });
});

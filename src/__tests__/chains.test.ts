import { describe, it, expect } from "vitest";
import {
  MAINNET_CHAINS,
  TESTNET_CHAINS,
  getSupportedChains,
  getChainById,
  getChainByCaip,
} from "../config/chains.js";

describe("chains config", () => {
  describe("MAINNET_CHAINS", () => {
    it("contains Base chain", () => {
      expect(MAINNET_CHAINS.BASE).toBeDefined();
      expect(MAINNET_CHAINS.BASE.id).toBe(8453);
      expect(MAINNET_CHAINS.BASE.caip).toBe("eip155:8453");
      expect(MAINNET_CHAINS.BASE.name).toBe("Base");
    });

    it("contains Optimism chain", () => {
      expect(MAINNET_CHAINS.OPTIMISM).toBeDefined();
      expect(MAINNET_CHAINS.OPTIMISM.id).toBe(10);
      expect(MAINNET_CHAINS.OPTIMISM.caip).toBe("eip155:10");
    });

    it("contains Arbitrum chain", () => {
      expect(MAINNET_CHAINS.ARBITRUM).toBeDefined();
      expect(MAINNET_CHAINS.ARBITRUM.id).toBe(42161);
      expect(MAINNET_CHAINS.ARBITRUM.caip).toBe("eip155:42161");
    });

    it("contains Polygon chain", () => {
      expect(MAINNET_CHAINS.POLYGON).toBeDefined();
      expect(MAINNET_CHAINS.POLYGON.id).toBe(137);
      expect(MAINNET_CHAINS.POLYGON.caip).toBe("eip155:137");
    });
  });

  describe("TESTNET_CHAINS", () => {
    it("contains Base Sepolia chain", () => {
      expect(TESTNET_CHAINS.BASE_SEPOLIA).toBeDefined();
      expect(TESTNET_CHAINS.BASE_SEPOLIA.id).toBe(84532);
      expect(TESTNET_CHAINS.BASE_SEPOLIA.caip).toBe("eip155:84532");
      expect(TESTNET_CHAINS.BASE_SEPOLIA.name).toBe("Base Sepolia");
    });

    it("contains OP Sepolia chain", () => {
      expect(TESTNET_CHAINS.OP_SEPOLIA).toBeDefined();
      expect(TESTNET_CHAINS.OP_SEPOLIA.id).toBe(11155420);
    });
  });

  describe("getSupportedChains", () => {
    it("returns mainnet chains when testnet is false", () => {
      const chains = getSupportedChains(false);
      expect(chains.length).toBe(4);
      expect(chains.map((c) => c.id)).toContain(8453);
      expect(chains.map((c) => c.id)).toContain(10);
    });

    it("returns testnet chains when testnet is true", () => {
      const chains = getSupportedChains(true);
      expect(chains.length).toBe(3);
      expect(chains.map((c) => c.id)).toContain(84532);
    });
  });

  describe("getChainById", () => {
    it("finds Base chain by ID", () => {
      const chain = getChainById(8453, false);
      expect(chain).toBeDefined();
      expect(chain?.name).toBe("Base");
    });

    it("finds Base Sepolia by ID", () => {
      const chain = getChainById(84532, true);
      expect(chain).toBeDefined();
      expect(chain?.name).toBe("Base Sepolia");
    });

    it("returns undefined for unknown chain ID", () => {
      const chain = getChainById(999999, false);
      expect(chain).toBeUndefined();
    });

    it("returns undefined when looking for mainnet chain in testnet", () => {
      const chain = getChainById(8453, true);
      expect(chain).toBeUndefined();
    });
  });

  describe("getChainByCaip", () => {
    it("finds Optimism by CAIP-2 identifier", () => {
      const chain = getChainByCaip("eip155:10", false);
      expect(chain).toBeDefined();
      expect(chain?.name).toBe("Optimism");
    });

    it("returns undefined for unknown CAIP identifier", () => {
      const chain = getChainByCaip("eip155:999999", false);
      expect(chain).toBeUndefined();
    });
  });
});

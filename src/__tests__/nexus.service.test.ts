import { describe, it, expect, beforeEach } from "vitest";
import { NexusService, getNexusService } from "../services/nexus.service.js";

describe("NexusService", () => {
  let service: NexusService;

  beforeEach(() => {
    service = new NexusService("testnet");
  });

  describe("constructor", () => {
    it("creates instance with testnet network", () => {
      const testnetService = new NexusService("testnet");
      expect(testnetService).toBeInstanceOf(NexusService);
      expect(testnetService.isReady()).toBe(false);
    });

    it("creates instance with mainnet network", () => {
      const mainnetService = new NexusService("mainnet");
      expect(mainnetService).toBeInstanceOf(NexusService);
      expect(mainnetService.isReady()).toBe(false);
    });
  });

  describe("isReady", () => {
    it("returns false before initialization", () => {
      expect(service.isReady()).toBe(false);
    });
  });

  describe("getBalancesForBridge", () => {
    it("throws error when not initialized", async () => {
      await expect(service.getBalancesForBridge()).rejects.toThrow(
        "NexusService not initialized"
      );
    });
  });

  describe("simulateBridge", () => {
    it("throws error when not initialized", async () => {
      await expect(
        service.simulateBridge({
          token: "USDC",
          amount: BigInt(1000000),
          toChainId: 8453,
        })
      ).rejects.toThrow("NexusService not initialized");
    });
  });

  describe("bridge", () => {
    it("throws error when not initialized", async () => {
      await expect(
        service.bridge({
          token: "USDC",
          amount: BigInt(1000000),
          toChainId: 8453,
        })
      ).rejects.toThrow("NexusService not initialized");
    });
  });

  describe("bridgeAndTransfer", () => {
    it("throws error when not initialized", async () => {
      await expect(
        service.bridgeAndTransfer({
          token: "USDC",
          amount: BigInt(1000000),
          toChainId: 8453,
          recipient: "0x1234567890123456789012345678901234567890",
        })
      ).rejects.toThrow("NexusService not initialized");
    });
  });
});

describe("getNexusService", () => {
  it("returns singleton instance", () => {
    const service1 = getNexusService("mainnet");
    const service2 = getNexusService("mainnet");
    expect(service1).toBe(service2);
  });
});

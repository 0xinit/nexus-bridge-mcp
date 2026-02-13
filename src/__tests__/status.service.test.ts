import { describe, it, expect } from "vitest";
import { reportBridgeStatus, getBridgeStatus, getAllOperations } from "../services/status.service.js";

describe("StatusService", () => {
  it("reports a new bridge operation", () => {
    const op = reportBridgeStatus({
      operationId: "status-test-1",
      txHash: "0xabc",
      fromChainId: 10,
      toChainId: 8453,
      token: "USDC",
      amount: "1000000",
      status: "pending",
    });

    expect(op.id).toBe("status-test-1");
    expect(op.status).toBe("pending");
    expect(op.createdAt).toBeGreaterThan(0);
  });

  it("retrieves a reported operation by ID", () => {
    reportBridgeStatus({
      operationId: "status-test-2",
      txHash: "0xdef",
      fromChainId: 42161,
      toChainId: 8453,
      token: "USDC",
      amount: "5000000",
      status: "completed",
    });

    const op = getBridgeStatus("status-test-2");
    expect(op).toBeDefined();
    expect(op!.txHash).toBe("0xdef");
    expect(op!.status).toBe("completed");
  });

  it("returns undefined for unknown operation", () => {
    expect(getBridgeStatus("nonexistent")).toBeUndefined();
  });

  it("updates an existing operation", () => {
    reportBridgeStatus({
      operationId: "status-test-3",
      txHash: "0xghi",
      fromChainId: 10,
      toChainId: 8453,
      token: "USDC",
      amount: "2000000",
      status: "pending",
    });

    const updated = reportBridgeStatus({
      operationId: "status-test-3",
      txHash: "0xghi",
      fromChainId: 10,
      toChainId: 8453,
      token: "USDC",
      amount: "2000000",
      status: "completed",
    });

    expect(updated.status).toBe("completed");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(updated.createdAt);
  });

  it("getAllOperations returns all operations sorted by updatedAt descending", () => {
    const ops = getAllOperations();
    expect(ops.length).toBeGreaterThan(0);

    // Verify sorted by updatedAt descending
    for (let i = 0; i < ops.length - 1; i++) {
      expect(ops[i].updatedAt).toBeGreaterThanOrEqual(ops[i + 1].updatedAt);
    }
  });
});

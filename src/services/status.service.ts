export interface BridgeOperation {
  id: string;
  txHash: string;
  fromChainId: number;
  toChainId: number;
  token: string;
  amount: string;
  status: "pending" | "completed" | "failed";
  error?: string;
  createdAt: number;
  updatedAt: number;
}

const operations = new Map<string, BridgeOperation>();

export function reportBridgeStatus(data: {
  operationId: string;
  txHash: string;
  fromChainId: number;
  toChainId: number;
  token: string;
  amount: string;
  status: "pending" | "completed" | "failed";
  error?: string;
}): BridgeOperation {
  const now = Date.now();
  const existing = operations.get(data.operationId);

  const operation: BridgeOperation = {
    id: data.operationId,
    txHash: data.txHash,
    fromChainId: data.fromChainId,
    toChainId: data.toChainId,
    token: data.token,
    amount: data.amount,
    status: data.status,
    error: data.error,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  operations.set(data.operationId, operation);
  return operation;
}

export function getBridgeStatus(id: string): BridgeOperation | undefined {
  return operations.get(id);
}

export function getAllOperations(): BridgeOperation[] {
  return Array.from(operations.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
}

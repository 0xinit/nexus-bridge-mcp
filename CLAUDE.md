# nexus-bridge-mcp

MCP server for cross-chain bridging via Avail Nexus. Runs locally alongside AI agents so the private key never leaves the machine.

## Architecture

```
Agent's Machine (local)
├── Claude / AI Agent
│   └── calls MCP tools: check_balances, execute_bridge, etc.
│
├── MCP Server (nexus-bridge) — runs as subprocess via stdio
│   ├── PRIVATE_KEY from env (never sent to Claude)
│   ├── viem publicClients for balance reads
│   ├── EIP-1193 adapter (translates viem ↔ Nexus SDK)
│   ├── Nexus SDK for bridge execution
│   └── Tools:
│       ├── get_chains         (no key needed)
│       ├── get_tokens         (no key needed)
│       ├── check_balances     (no key needed, reads public chain data)
│       ├── get_bridge_quote   (no key needed)
│       ├── execute_bridge     (needs PRIVATE_KEY + Nexus SDK)
│       └── get_bridge_status  (no key needed, in-memory lookup)
│
└── .env with PRIVATE_KEY, NETWORK_MODE, optional RPC_* overrides
```

## Quick Start

```bash
npm install
cp .env.example .env
npm run build
npm test                # Run 66 unit tests
npm run typecheck       # TypeScript check
```

## Project Structure

```
src/
├── index.ts               # MCP server entry point with all tool definitions
├── config/
│   ├── env.ts             # Zod environment validation
│   ├── chains.ts          # Supported chains (Base, OP, Arb, Polygon)
│   └── tokens.ts          # Token addresses per chain (USDC, USDT)
├── services/
│   ├── eip1193-adapter.ts # EIP-1193 provider for headless Nexus SDK usage
│   ├── nexus.service.ts   # Nexus SDK wrapper for bridging
│   ├── balance.service.ts # Multi-chain ERC-20 balance lookups via viem
│   └── status.service.ts  # In-memory bridge operation tracking
└── __tests__/             # 66 Vitest tests
    ├── index.test.ts      # MCP tool handler logic tests
    ├── eip1193-adapter.test.ts # EIP-1193 adapter tests
    ├── chains.test.ts     # Chain config tests
    ├── tokens.test.ts     # Token config tests
    ├── nexus.service.test.ts  # Nexus service tests
    └── status.service.test.ts # Status tracking tests
```

## MCP Tools

| Tool | Params | Description |
|------|--------|-------------|
| `get_chains` | none | List supported chains (id, name, caip, rpcUrl, explorer) |
| `get_tokens` | `chainId?` (optional) | List supported tokens per chain with contract addresses |
| `check_balances` | `address` | Multi-chain ERC-20 balances for any wallet |
| `get_bridge_quote` | `fromChainId, toChainId, token, amount` | Fee estimate, route, estimated time |
| `execute_bridge` | `fromChainId, toChainId, token, amount` | Execute bridge using local wallet via Nexus SDK |
| `get_bridge_status` | `operationId` | Check tracked bridge operation status |

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload (tsx watch) |
| `npm run build` | Build TypeScript |
| `npm start` | Run built MCP server |
| `npm test` | Run 66 unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Environment Variables

```bash
NETWORK_MODE=testnet               # testnet | mainnet
PRIVATE_KEY=0x...                  # Optional — only needed for execute_bridge
RPC_BASE=                          # Optional custom RPC for Base
RPC_OPTIMISM=                      # Optional custom RPC for Optimism
RPC_ARBITRUM=                      # Optional custom RPC for Arbitrum
RPC_POLYGON=                       # Optional custom RPC for Polygon
```

## Supported Chains

### Testnet
- Base Sepolia (84532)
- OP Sepolia (11155420)
- Arbitrum Sepolia (421614)

### Mainnet
- Base (8453)
- Optimism (10)
- Arbitrum (42161)
- Polygon (137)

## Supported Tokens
- **USDC** — all chains (mainnet + testnet)
- **USDT** — mainnet chains only

## Claude Desktop / Claude Code Config

```json
{
  "mcpServers": {
    "nexus-bridge": {
      "command": "node",
      "args": ["path/to/dist/index.js"],
      "env": {
        "NETWORK_MODE": "testnet",
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Bridge Flow

1. Agent calls `check_balances` → sees USDC on Optimism, not on Base
2. Agent calls `get_bridge_quote` → gets fee estimate and route
3. Agent calls `execute_bridge` → MCP server bridges via Nexus SDK using local wallet
4. Agent calls `get_bridge_status` → confirms completion
5. Agent now has USDC on Base → pays x402 service directly

## EIP-1193 Adapter (execute_bridge internals)

The Nexus SDK requires a browser-style EIP-1193 Ethereum provider. The adapter
(`src/services/eip1193-adapter.ts`) bridges between viem and the SDK:

- `eth_accounts` / `eth_requestAccounts` → returns wallet address from PRIVATE_KEY
- `eth_chainId` → returns current chain as hex
- `wallet_switchEthereumChain` → switches active chain (SDK calls this during bridge)
- `wallet_addEthereumChain` → dynamically registers chains the SDK needs
- `eth_sendTransaction` → sends transactions via viem WalletClient
- `personal_sign` → signs raw message bytes (used for SIWE + RFF signatures)
- `eth_signTypedData_v4` → signs typed data with EIP712Domain stripped (viem convention)
- Default → delegates to viem PublicClient (eth_call, eth_getBalance, etc.)

### Pre-approval strategy

The `execute_bridge` tool pre-approves maxUint256 to the Nexus vault contract before
calling `sdk.bridge()`. This bypasses the SDK's sponsored permit flow (which uses
EIP-2612 permits via Multicall3 and can fail on testnet tokens).

Vault contract addresses are from `@avail-project/ca-common` (FOLLY = testnet, CERISE = mainnet).

### SDK hooks

The NexusService sets `setOnAllowanceHook` (auto-approves "max") and `setOnIntentHook`
(auto-approves) after SDK initialization for headless/agent mode.

## Testing

```bash
npm test                                           # Unit tests (66 tests)
npm run typecheck                                  # Type check
npx @modelcontextprotocol/inspector dist/index.js  # Interactive MCP Inspector
```

## Key Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework (stdio transport)
- `viem` — Ethereum interactions & ERC-20 balance reads
- `zod` — Schema validation for tool params and env
- `@avail-project/nexus-core` — Cross-chain bridging (optional peer dep)

## Code Conventions

- ESM imports with `.js` extensions
- Zod for runtime validation (tool params, env)
- Tests in `__tests__` with `.test.ts` suffix
- CAIP-2 chain identifiers (e.g., `eip155:8453`)

## Resources

- [Avail Nexus SDK](https://docs.availproject.org/nexus)
- [x402 Protocol Docs](https://docs.x402.org)
- [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)
- [Circle USDC Faucet](https://faucet.circle.com/)

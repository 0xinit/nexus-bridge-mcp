# nexus-bridge-mcp

MCP server for cross-chain bridging via [Avail Nexus](https://docs.availproject.org/nexus). Runs locally alongside AI agents so the private key never leaves the machine.

## Install

```bash
git clone <repo-url>
cd nexus-bridge-mcp
npm install
cp .env.example .env
npm run build
```

## Configure

### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "nexus-bridge": {
      "command": "node",
      "args": ["/path/to/nexus-bridge-mcp/dist/index.js"],
      "env": {
        "NETWORK_MODE": "mainnet",
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nexus-bridge": {
      "command": "node",
      "args": ["/path/to/nexus-bridge-mcp/dist/index.js"],
      "env": {
        "NETWORK_MODE": "mainnet",
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### OpenAI Agents SDK

```python
from agents import Agent
from agents.mcp import MCPServerStdio

async with MCPServerStdio(
    name="nexus-bridge",
    params={
        "command": "node",
        "args": ["/path/to/nexus-bridge-mcp/dist/index.js"],
        "env": {
            "NETWORK_MODE": "mainnet",
            "PRIVATE_KEY": "0x..."
        }
    }
) as server:
    agent = Agent(name="Bridge Agent", mcp_servers=[server])
```

### Any MCP-Compatible Client

This server uses the [Model Context Protocol](https://modelcontextprotocol.io) stdio transport. Any MCP client (Cursor, Windsurf, Goose, Zed, etc.) can connect with:

- **Command:** `node`
- **Args:** `["/path/to/nexus-bridge-mcp/dist/index.js"]`
- **Env:** `NETWORK_MODE`, `PRIVATE_KEY` (see below)

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NETWORK_MODE` | No | `testnet` | Default network (`testnet` or `mainnet`). Tools can override per-call. |
| `PRIVATE_KEY` | For bridging | — | Hex private key. Only needed for `execute_bridge`. |
| `RPC_BASE` | No | Public RPC | Custom RPC for Base |
| `RPC_OPTIMISM` | No | Public RPC | Custom RPC for Optimism |
| `RPC_ARBITRUM` | No | Public RPC | Custom RPC for Arbitrum |
| `RPC_POLYGON` | No | Public RPC | Custom RPC for Polygon |

## Tools

| Tool | Description |
|------|-------------|
| `get_chains` | List supported chains |
| `get_tokens` | List tokens per chain with contract addresses |
| `check_balances` | Multi-chain ERC-20 balances for any wallet |
| `get_bridge_quote` | Fee estimate and route for a bridge |
| `execute_bridge` | Execute bridge using local wallet via Nexus SDK |
| `get_bridge_status` | Check status of a tracked bridge operation |

All tools except `get_bridge_status` accept an optional `network` parameter (`"testnet"` or `"mainnet"`) to override `NETWORK_MODE` per call.

## Usage Examples

### Check balances on mainnet

```
Agent: "What USDC do I have across chains?"
→ calls check_balances { address: "0x...", network: "mainnet" }
```

```json
{
  "address": "0x...",
  "networkMode": "mainnet",
  "balances": [
    { "chain": "Base", "chainId": 8453, "token": "USDC", "balance": "150.5", "raw": "150500000" },
    { "chain": "Optimism", "chainId": 10, "token": "USDC", "balance": "0", "raw": "0" },
    { "chain": "Arbitrum", "chainId": 42161, "token": "USDC", "balance": "25.0", "raw": "25000000" }
  ]
}
```

### Bridge USDC from Arbitrum to Base

```
Agent: "Bridge 25 USDC from Arbitrum to Base"
→ calls execute_bridge { fromChainId: 42161, toChainId: 8453, token: "USDC", amount: "25", network: "mainnet" }
```

```json
{
  "operationId": "bridge-1739...-a3f2",
  "success": true,
  "txHash": "0xabc...",
  "from": { "chain": "Arbitrum", "chainId": 42161 },
  "to": { "chain": "Base", "chainId": 8453 },
  "token": "USDC",
  "amount": "25"
}
```

### Dual-network in one session

```
Agent: "Show me chains on both networks"
→ calls get_chains { network: "testnet" }  // Base Sepolia, OP Sepolia, Arb Sepolia
→ calls get_chains { network: "mainnet" }  // Base, Optimism, Arbitrum, Polygon
```

## Supported Chains

| Chain | Chain ID | Network |
|-------|----------|---------|
| Base | 8453 | Mainnet |
| Optimism | 10 | Mainnet |
| Arbitrum | 42161 | Mainnet |
| Polygon | 137 | Mainnet |
| Base Sepolia | 84532 | Testnet |
| OP Sepolia | 11155420 | Testnet |
| Arbitrum Sepolia | 421614 | Testnet |

## Supported Tokens

| Token | Mainnet | Testnet |
|-------|---------|---------|
| USDC | All chains | All chains |
| USDT | All chains | — |

## Bridge Flow

1. `check_balances` — see USDC across chains
2. `get_bridge_quote` — get fee estimate and route
3. `execute_bridge` — bridge via Nexus SDK using local wallet
4. `get_bridge_status` — confirm completion

## Architecture

```
Agent's Machine (local)
├── AI Agent (Claude Code, OpenAI Agents SDK, Cursor, etc.)
│   └── calls MCP tools over stdio
│
└── MCP Server (nexus-bridge) — subprocess
    ├── PRIVATE_KEY from env (never sent to the agent)
    ├── viem for chain reads + tx signing
    ├── EIP-1193 adapter (viem ↔ Nexus SDK)
    └── Nexus SDK for bridge execution
```

## Development

```bash
npm run dev          # Start with hot reload
npm run build        # Build TypeScript
npm test             # 72 unit tests
npm run typecheck    # Type check
npm run lint         # ESLint
```

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Known Issues

FOLLY testnet backend fails at the token collection step (`VSC: create-rff: collections failed`). This is an Avail infrastructure issue, not a bug in this server. Mainnet works.

## Resources

- [Avail Nexus SDK](https://docs.availproject.org/nexus)
- [MCP Protocol](https://modelcontextprotocol.io)
- [x402 Protocol](https://docs.x402.org)

## License

MIT

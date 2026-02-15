# x402-nexus-api

Payment-gated API using [x402 protocol](https://x402.org) with [Avail Nexus](https://docs.availproject.org/nexus) cross-chain bridging for AI agents.

## Overview

This API enables micropayments for AI agents using the x402 HTTP 402 Payment Required standard. When agents don't have funds on the required chain, they can use Avail Nexus to bridge funds from other supported chains.

### Features

- **x402 Payment Protocol**: HTTP-native micropayments using the 402 status code
- **Multi-Chain Support**: Accept payments on Base, Optimism, Arbitrum, and Polygon
- **Cross-Chain Bridging**: Avail Nexus integration for seamless cross-chain payments
- **Agent SDK**: Client library for easy integration with AI agents
- **Tiered Pricing**: Basic ($0.001), Standard ($0.01), and Premium ($0.10) tiers

## Quick Start

### Prerequisites

- Node.js 20+
- An EVM wallet address for receiving payments

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd x402-nexus-api

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your payment address
```

### Running the Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start

# With Docker
docker-compose up
```

The server starts at `http://localhost:4021`.

## API Reference

### Free Endpoints

#### `GET /`
Returns API information and available endpoints.

#### `GET /api/v1/payments/supported`
Lists supported chains and tokens.

```json
{
  "network": "testnet",
  "chains": [
    { "id": 84532, "name": "Base Sepolia", "caip": "eip155:84532" }
  ],
  "tokens": ["USDC", "ETH"],
  "priceTiers": {
    "basic": "$0.001",
    "standard": "$0.01",
    "premium": "$0.10"
  }
}
```

#### `GET /api/v1/payments/routes`
Lists all payment-gated routes with their prices.

#### `POST /api/v1/payments/prepare`
Get guidance on how to pay, including bridge options if needed.

```json
{
  "targetChainId": 8453,
  "requiredAmount": "$0.01",
  "agentAddress": "0x..."
}
```

### Payment-Gated Endpoints

These endpoints require payment via the x402 protocol.

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/v1/health` | $0.001 | Health check |
| `GET /api/v1/data` | $0.001 | Simple data query |
| `POST /api/v1/inference` | $0.01 | AI inference |
| `POST /api/v1/query` | $0.10 | Complex query |

## Agent Integration

### Using the Client SDK

```typescript
import { X402NexusClient } from '@x402-nexus/client';

const client = new X402NexusClient({
  privateKey: '0x...',
  network: 'testnet',
});

// Make a paid request - payment is handled automatically
const result = await client.get('http://localhost:4021/api/v1/data');
console.log(result.data);
```

### With Cross-Chain Bridging

```typescript
const client = new X402NexusClient({
  privateKey: '0x...',
  network: 'mainnet',
  preferredChainId: 8453, // Base
});

// Initialize Nexus for cross-chain bridging
await client.initializeNexus();

// If funds are on a different chain, client will auto-bridge
const result = await client.post('http://api.example.com/api/v1/inference', {
  prompt: 'Hello, world!',
});
```

### Manual Integration

1. Make a request to a gated endpoint
2. Receive 402 response with payment requirements
3. Create and sign payment transaction
4. Retry request with `X-PAYMENT` header

```typescript
// 1. Initial request returns 402
const response = await fetch('http://localhost:4021/api/v1/data');
// Status: 402 Payment Required

// 2. Extract payment info from response
const paymentInfo = await response.json();
// { accepts: [{ scheme: 'exact', price: '$0.001', network: 'eip155:84532', payTo: '0x...' }] }

// 3. Create payment (using x402 client libraries)
// 4. Retry with payment header
const paidResponse = await fetch('http://localhost:4021/api/v1/data', {
  headers: {
    'X-PAYMENT': '<base64-encoded-payment>',
  },
});
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4021` |
| `NODE_ENV` | Environment | `development` |
| `NETWORK_MODE` | `testnet` or `mainnet` | `testnet` |
| `PAYMENT_ADDRESS_EVM` | Your payment receiving address | Required |
| `FACILITATOR_URL` | x402 facilitator URL | `https://x402.org/facilitator` |

### Testnet Configuration

For testing, use:
- Network: Base Sepolia (chain ID: 84532)
- Facilitator: `https://x402.org/facilitator`
- Test wallet: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Foundry default)

### Mainnet Configuration

For production:
- Networks: Base, Optimism, Arbitrum, Polygon
- Facilitator: `https://api.cdp.coinbase.com/platform/v2/x402`

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Format code
npm run format
```

## Docker Deployment

```bash
# Build and run
docker-compose up --build

# Development with hot reload
docker-compose --profile dev up api-dev
```

## Architecture

```
AI Agent
    │
    ├── x402 Client (payment signing)
    ├── Nexus SDK (cross-chain bridging)
    └── Multi-Chain Wallet
            │
            ▼
    x402-nexus-api
    │
    ├── Express.js Server
    ├── x402 Payment Middleware
    ├── Payment Verification (via Facilitator)
    └── Protected API Routes
            │
            ▼
    Blockchain Networks
    │
    ├── Base (8453)
    ├── Optimism (10)
    ├── Arbitrum (42161)
    └── Polygon (137)
```

## Resources

- [x402 Protocol Documentation](https://docs.x402.org)
- [x402 GitHub](https://github.com/coinbase/x402)
- [Avail Nexus SDK](https://docs.availproject.org/nexus)
- [Coinbase Developer Platform](https://docs.cdp.coinbase.com)

## License

MIT

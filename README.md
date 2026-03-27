# Crypto Token Analyzer

TEE-verified token risk analysis powered by [OpenGradient](https://opengradient.ai).

Analyze any EVM token by contract address — get an A–F risk grade with breakdown across contract security, holder distribution, and liquidity depth. All analysis is backed by OpenGradient's Trusted Execution Environment for verifiable AI inference.

## Features

- **Multi-chain support** — Ethereum, Base, BSC
- **On-chain data** — Real ERC-20 metadata, Transfer event analysis, Uniswap V2 liquidity checks
- **Risk grading** — A through F with per-factor breakdown
- **TEE verification** — OpenGradient settlement proofs via x402 protocol
- **Dark-themed UI** — OpenGradient brand design system

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS v4
- **On-chain:** viem (EVM contract reads, event log scanning)
- **AI Inference:** OpenGradient x402 HTTP gateway
- **Payment:** @x402/fetch + @x402/evm on Base Sepolia

## Quick Start

```bash
git clone https://github.com/Matyv7/crypto-token-analyzer.git
cd crypto-token-analyzer
npm install
```

Create `.env.local`:
```
OG_PRIVATE_KEY=0xyour_private_key_here
```

Get testnet tokens from [faucet.opengradient.ai](https://faucet.opengradient.ai/).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/     # POST /api/analyze — main analysis endpoint
│   │   ├── health/      # GET /api/health — health check
│   │   └── smoke-test/  # GET /api/smoke-test — OpenGradient connectivity test
│   ├── components/
│   │   ├── TokenInput.tsx      # Address input + chain selector
│   │   └── AnalysisResult.tsx  # Risk grade display + factor breakdown
│   └── page.tsx               # Main page
├── lib/
│   ├── opengradient.ts  # x402 client with TEE_LLM constants
│   ├── analyzer.ts      # Risk scoring engine
│   ├── evm-fetcher.ts   # On-chain data via viem
│   ├── chains.ts        # Chain configs + address detection
│   ├── types.ts         # TypeScript types
│   └── env.ts           # Zod env validation
```

## OpenGradient Integration

This project uses OpenGradient's x402 HTTP gateway for TEE-verified LLM inference:

- **Endpoint:** `https://llm.opengradient.ai/v1/chat/completions`
- **Payment:** x402 protocol with OPG tokens on Base Sepolia
- **Settlement:** Individual Full mode for complete on-chain audit trail
- **Verification:** Settlement hashes viewable at [explorer.opengradient.ai](https://explorer.opengradient.ai)

## License

MIT

# Technology Stack

**Project:** Crypto Token Analyzer (OpenGradient TEE)
**Researched:** 2026-03-27
**Overall confidence:** HIGH — all versions verified against PyPI and official sources

---

## Recommended Stack

### Core AI / Inference Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `opengradient` | 0.9.3 | TEE-verified LLM inference, tool calling, x402 payment | The platform constraint — all inference must go through OpenGradient. Handles OPG token approval, settlement modes, and proof generation. No alternative. |
| `og.TEE_LLM.CLAUDE_OPUS_4_6` | — | Primary analysis model | Strongest reasoning among available models for multi-step token risk analysis. GPT-5 is viable fallback. Set `temperature=0.0` for deterministic, auditable output. |

**Model choice rationale:** Claude Opus 4.6 and GPT-5 are the two strongest available models. Claude Opus 4.6 is preferred for structured output (the A–F grade + breakdown) because Anthropic models reliably follow complex JSON schemas. GPT-5 is the fallback if rate limits are hit. Gemini 3 Pro and Grok-4 are deprioritized — less tested for structured schema adherence.

**Settlement mode:** `og.x402SettlementMode.INDIVIDUAL_FULL` — required by project spec. Records input/output hashes on-chain for each analysis call. Produces the `payment_hash` used as the verification proof displayed in the UI.

---

### Backend Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | 3.12 | Runtime | 3.12 is the production sweet spot — full async support, faster than 3.11, wider library compatibility than 3.13. The `opengradient` SDK requires ≥3.10. |
| FastAPI | 0.135.2 | REST API + async server | Async-native framework that matches OpenGradient SDK's `asyncio.run()` pattern. Auto-generates OpenAPI docs. Handles concurrent on-chain RPC calls cleanly with `async def` routes. |
| uvicorn | latest stable | ASGI server | Standard ASGI server for FastAPI. Single process for v1 (analysis is I/O-bound, not CPU-bound). Add gunicorn workers only if concurrency becomes a problem. |
| pydantic-settings | 2.13.1 | Config / env var management | FastAPI's native config pattern. Validates `OG_PRIVATE_KEY`, RPC URLs, chain IDs at startup — fails fast before any user request if config is broken. |
| httpx | 0.28.1 | Async HTTP client | Needed for any outbound HTTP calls (e.g., Solana RPC via JSON-RPC POST). Fully async, compatible with FastAPI's event loop. Do NOT use `requests` — it blocks the event loop. |

---

### EVM On-Chain Data (Ethereum, Base, BSC)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| web3.py | 7.14.1 | EVM contract calls, event log scanning, token data | The dominant Python EVM library. v7.x is async-compatible. Handles ERC-20 ABI calls (`totalSupply`, `balanceOf`, `Transfer` event logs), reading LP pool reserves from Uniswap V2/V3 pairs, and contract bytecode fetching. |

**RPC provider strategy:** Use public RPC endpoints for the testnet MVP. For production, configure a paid provider (Alchemy or Infura free tier: ~100K requests/day). The project uses three EVM chains:
- Ethereum: `https://mainnet.infura.io/v3/{KEY}` or Alchemy endpoint
- Base: `https://mainnet.base.org` (official, free, no key required)
- BSC: `https://bsc-dataseed.binance.org/` (official, free, no key required)

**What web3.py fetches for token analysis:**
- ERC-20 metadata: `name()`, `symbol()`, `decimals()`, `totalSupply()`
- Contract bytecode via `eth.get_code()` — checks if contract is verified/non-proxy
- Top holder distribution: replay `Transfer` event logs, aggregate by address (resource-intensive — cap at last 10K blocks or use `getTokenLargestAccounts` equivalent pattern)
- Liquidity: query Uniswap V2 pair `getReserves()` for the token/WETH pair
- Transaction patterns: last N transactions to the contract via `eth_getLogs`

**Limitation (MEDIUM confidence):** Replaying Transfer events across all blocks is expensive and slow against public RPCs. The LLM's tool calling architecture mitigates this — the model only requests data it needs for its analysis, not everything upfront. Design tools to fetch targeted slices (e.g., "get top 20 holders" not "get all holders ever").

---

### Solana On-Chain Data (SPL Tokens)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| solana | 0.36.11 | Solana JSON-RPC client, SPL token program interaction | The official Python Solana SDK. Provides `AsyncClient` for non-blocking RPC calls, SPL token account queries, and mint metadata. |
| solders | 0.27.1 | Core types: Pubkey, Keypair, transaction primitives | solana-py is built on solders. Import `Pubkey` from solders for address validation. Solders handles Rust-native performance-sensitive operations. |

**What solana SDK fetches for SPL analysis:**
- Mint account: `get_account_info(mint_address)` — supply, decimals, mint/freeze authorities
- Top holders: `get_token_largest_accounts(mint)` — returns top 20 token accounts by balance (free, single RPC call)
- Total supply: `get_token_supply(mint)` — combine with top-holder data to compute concentration ratios
- Token accounts: `get_token_accounts_by_owner()` — used when verifying specific wallet holdings

**RPC endpoint:** `https://api.mainnet-beta.solana.com` (official, free, rate-limited at ~100 RPS). For higher throughput, Helius free tier (100K credits/day) or Alchemy Solana endpoint.

---

### Frontend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.2.1 | React framework with App Router | Current stable. App Router enables server components — the analysis result page can be SSR'd for fast initial render. Single-page app behavior for the input form. TypeScript first-class. |
| React | 19.x | UI | Ships with Next.js 16. No separate install needed. |
| TypeScript | 5.x | Type safety | Required for shadcn/ui components and the verification hash display logic. Prevents runtime errors when handling blockchain address strings. |
| Tailwind CSS | 4.x | Styling | v4 (released Jan 2025) — CSS-first configuration, no `tailwind.config.ts` needed, 5x faster builds than v3. Pairs with shadcn/ui. |
| shadcn/ui | latest | Component library | Component source code is copied into your project — no external dependency lock-in. Provides the `Card`, `Badge`, `Input`, `Button` components needed for the token analysis UI. Built on Radix UI primitives. |

**Why Next.js over pure React + Vite:** The verification proof link (pointing to OpenGradient block explorer) needs a stable URL structure. Next.js App Router gives clean dynamic routes like `/analysis/[txHash]` and built-in API routes for proxying backend calls without CORS configuration.

---

### Configuration and Environment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pydantic-settings | 2.13.1 | Backend config management | Validates all env vars at startup with type safety. Reads `OG_PRIVATE_KEY`, `ETH_RPC_URL`, `BASE_RPC_URL`, `BSC_RPC_URL`, `SOL_RPC_URL`. |
| python-dotenv | bundled with pydantic-settings | `.env` file loading | pydantic-settings includes dotenv support — no separate install needed. |

**Required environment variables:**
```
OG_PRIVATE_KEY=          # Wallet private key for OpenGradient SDK
ETH_RPC_URL=             # Ethereum mainnet RPC (Alchemy/Infura)
BASE_RPC_URL=            # Base mainnet RPC
BSC_RPC_URL=             # BSC mainnet RPC
SOL_RPC_URL=             # Solana mainnet RPC
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend framework | FastAPI | Django REST Framework | Django is synchronous-first. OpenGradient SDK uses `asyncio.run()` — mixing sync Django with async inference would require `asgiref.sync.sync_to_async` wrappers everywhere. FastAPI is async-native. |
| Backend framework | FastAPI | Flask | Flask lacks native async support (requires `flask[async]` extension). FastAPI is the obvious successor for new async Python APIs. |
| EVM library | web3.py 7.x | ethers.py | `ethers.py` is a thin Python port with sparse documentation and no production track record. web3.py has 6+ years of production usage, full Ethereum Foundation support. |
| Solana library | solana-py + solders | solathon | `solathon` has low adoption and is not maintained. solana-py is the official community SDK referenced in Solana docs. |
| Frontend | Next.js 16 | Pure Vite + React | No server-side rendering, no file-based routing, no built-in API proxy routes. Next.js handles all of this and is the dominant React framework. |
| Frontend | Next.js 16 | SvelteKit | Smaller ecosystem, fewer component libraries that include shadcn/ui-equivalent. Team likely more familiar with React. |
| Styling | Tailwind v4 + shadcn/ui | Material UI (MUI) | MUI ships heavy JS bundles and imposes Google Material design language. Tailwind + shadcn/ui produces lighter bundles and a more custom look appropriate for a crypto tool. |
| LLM model (primary) | Claude Opus 4.6 | Gemini 3 Pro | Gemini 3 Pro is less tested for strict JSON schema adherence in tool-calling loops. Claude Opus 4.6 is more reliable for structured output with complex instructions. |
| Config | pydantic-settings | python-decouple | pydantic-settings is the FastAPI-official pattern with type validation, not just string loading. |

---

## Installation

### Backend

```bash
pip install \
  opengradient==0.9.3 \
  fastapi==0.135.2 \
  "uvicorn[standard]" \
  "web3==7.14.1" \
  "solana==0.36.11" \
  "solders==0.27.1" \
  "httpx==0.28.1" \
  "pydantic-settings==2.13.1"
```

### Frontend

```bash
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

# Add shadcn/ui
npx shadcn@latest init

# Core components needed
npx shadcn@latest add card badge input button alert separator
```

---

## Architecture Notes for Roadmap

**Backend serves two roles:**

1. **Tool executor** — FastAPI exposes endpoints that the LLM's tool calls map to. The OpenGradient SDK sends tool call requests (e.g., `get_token_holders`, `get_liquidity_data`), your backend executes them against web3.py/solana-py, and returns results back into the chat loop.

2. **Orchestrator** — Manages the full analysis lifecycle: receive user input → validate address/ticker → detect chain → run OpenGradient inference with tools → extract grade + breakdown → return with payment hash.

**Tool calling loop pattern** (from `OPENGRADIENT_REFERENCE.md` example):
```python
result = await llm.chat(
    model=og.TEE_LLM.CLAUDE_OPUS_4_6,
    messages=messages,
    tools=tools,                              # on-chain data fetcher definitions
    settlement_mode=og.x402SettlementMode.INDIVIDUAL_FULL
)
# payment_hash on result is the verification proof displayed in UI
```

**Chain detection:** Ethereum and Base addresses are both 0x-prefixed EVM addresses. Distinguish by attempting contract lookup on each chain. BSC same pattern. Solana addresses are base58-encoded 32-byte strings — trivially different from EVM addresses. Ticker-to-address resolution requires a lookup table or on-chain registry (out of scope for v1; accept contract addresses only as primary input, ticker as optional hint).

---

## Sources

- OpenGradient SDK PyPI: https://pypi.org/project/opengradient/ (verified 2026-03-27, v0.9.3)
- web3.py PyPI: https://pypi.org/project/web3/ (verified 2026-03-27, v7.14.1)
- web3.py docs: https://web3py.readthedocs.io/ (v7.14.1)
- FastAPI PyPI: https://pypi.org/project/fastapi/ (verified 2026-03-27, v0.135.2)
- FastAPI production patterns: https://orchestrator.dev/blog/2025-1-30-fastapi-production-patterns/
- solana-py PyPI: https://pypi.org/project/solana/ (verified 2026-03-27, v0.36.11)
- solders PyPI: https://pypi.org/project/solders/ (verified 2026-03-27, v0.27.1)
- httpx PyPI: https://pypi.org/project/httpx/ (verified 2026-03-27, v0.28.1)
- pydantic-settings PyPI: https://pypi.org/project/pydantic-settings/ (verified 2026-03-27, v2.13.1)
- Next.js 16.2 release: https://nextjs.org/blog/next-16-2 (March 18, 2026)
- Tailwind CSS v4 release: https://tailwindcss.com/blog/tailwindcss-v4 (January 22, 2025)
- shadcn/ui Next.js install: https://ui.shadcn.com/docs/installation/next
- Solana getTokenLargestAccounts: https://solana.com/docs/rpc/http/gettokenlargestaccounts
- Solana getTokenSupply: https://solana.com/docs/rpc/http/gettokensupply
- FastAPI settings pattern: https://fastapi.tiangolo.com/advanced/settings/
- OpenGradient SDK reference: OPENGRADIENT_REFERENCE.md (local project file)

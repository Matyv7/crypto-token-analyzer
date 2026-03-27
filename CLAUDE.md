<!-- GSD:project-start source:PROJECT.md -->
## Project

**Crypto Token Analyzer**

A web-based tool that analyzes crypto tokens by contract address or ticker symbol, providing a letter-grade risk score (A–F) and technical analysis. All analysis runs through OpenGradient's TEE-verified LLM inference, producing cryptographic proof that the AI actually performed the analysis — displayed prominently as a core trust signal.

**Core Value:** Users can verify that the token analysis is real and untampered — the on-chain verification proof is the differentiator, not just the analysis itself.

### Constraints

- **Platform**: Must use OpenGradient SDK for all LLM inference — no direct API calls to OpenAI/Anthropic
- **Data**: On-chain data only — no external price APIs
- **Payment**: x402 gateway with OPG tokens on Base Sepolia (testnet)
- **Verification**: Individual Full settlement mode for complete on-chain audit trail
- **Chains**: Must support Ethereum, Base, BSC (EVM) and Solana (SPL)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core AI / Inference Layer
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `opengradient` | 0.9.3 | TEE-verified LLM inference, tool calling, x402 payment | The platform constraint — all inference must go through OpenGradient. Handles OPG token approval, settlement modes, and proof generation. No alternative. |
| `og.TEE_LLM.CLAUDE_OPUS_4_6` | — | Primary analysis model | Strongest reasoning among available models for multi-step token risk analysis. GPT-5 is viable fallback. Set `temperature=0.0` for deterministic, auditable output. |
### Backend Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | 3.12 | Runtime | 3.12 is the production sweet spot — full async support, faster than 3.11, wider library compatibility than 3.13. The `opengradient` SDK requires ≥3.10. |
| FastAPI | 0.135.2 | REST API + async server | Async-native framework that matches OpenGradient SDK's `asyncio.run()` pattern. Auto-generates OpenAPI docs. Handles concurrent on-chain RPC calls cleanly with `async def` routes. |
| uvicorn | latest stable | ASGI server | Standard ASGI server for FastAPI. Single process for v1 (analysis is I/O-bound, not CPU-bound). Add gunicorn workers only if concurrency becomes a problem. |
| pydantic-settings | 2.13.1 | Config / env var management | FastAPI's native config pattern. Validates `OG_PRIVATE_KEY`, RPC URLs, chain IDs at startup — fails fast before any user request if config is broken. |
| httpx | 0.28.1 | Async HTTP client | Needed for any outbound HTTP calls (e.g., Solana RPC via JSON-RPC POST). Fully async, compatible with FastAPI's event loop. Do NOT use `requests` — it blocks the event loop. |
### EVM On-Chain Data (Ethereum, Base, BSC)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| web3.py | 7.14.1 | EVM contract calls, event log scanning, token data | The dominant Python EVM library. v7.x is async-compatible. Handles ERC-20 ABI calls (`totalSupply`, `balanceOf`, `Transfer` event logs), reading LP pool reserves from Uniswap V2/V3 pairs, and contract bytecode fetching. |
- Ethereum: `https://mainnet.infura.io/v3/{KEY}` or Alchemy endpoint
- Base: `https://mainnet.base.org` (official, free, no key required)
- BSC: `https://bsc-dataseed.binance.org/` (official, free, no key required)
- ERC-20 metadata: `name()`, `symbol()`, `decimals()`, `totalSupply()`
- Contract bytecode via `eth.get_code()` — checks if contract is verified/non-proxy
- Top holder distribution: replay `Transfer` event logs, aggregate by address (resource-intensive — cap at last 10K blocks or use `getTokenLargestAccounts` equivalent pattern)
- Liquidity: query Uniswap V2 pair `getReserves()` for the token/WETH pair
- Transaction patterns: last N transactions to the contract via `eth_getLogs`
### Solana On-Chain Data (SPL Tokens)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| solana | 0.36.11 | Solana JSON-RPC client, SPL token program interaction | The official Python Solana SDK. Provides `AsyncClient` for non-blocking RPC calls, SPL token account queries, and mint metadata. |
| solders | 0.27.1 | Core types: Pubkey, Keypair, transaction primitives | solana-py is built on solders. Import `Pubkey` from solders for address validation. Solders handles Rust-native performance-sensitive operations. |
- Mint account: `get_account_info(mint_address)` — supply, decimals, mint/freeze authorities
- Top holders: `get_token_largest_accounts(mint)` — returns top 20 token accounts by balance (free, single RPC call)
- Total supply: `get_token_supply(mint)` — combine with top-holder data to compute concentration ratios
- Token accounts: `get_token_accounts_by_owner()` — used when verifying specific wallet holdings
### Frontend
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.2.1 | React framework with App Router | Current stable. App Router enables server components — the analysis result page can be SSR'd for fast initial render. Single-page app behavior for the input form. TypeScript first-class. |
| React | 19.x | UI | Ships with Next.js 16. No separate install needed. |
| TypeScript | 5.x | Type safety | Required for shadcn/ui components and the verification hash display logic. Prevents runtime errors when handling blockchain address strings. |
| Tailwind CSS | 4.x | Styling | v4 (released Jan 2025) — CSS-first configuration, no `tailwind.config.ts` needed, 5x faster builds than v3. Pairs with shadcn/ui. |
| shadcn/ui | latest | Component library | Component source code is copied into your project — no external dependency lock-in. Provides the `Card`, `Badge`, `Input`, `Button` components needed for the token analysis UI. Built on Radix UI primitives. |
### Configuration and Environment
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pydantic-settings | 2.13.1 | Backend config management | Validates all env vars at startup with type safety. Reads `OG_PRIVATE_KEY`, `ETH_RPC_URL`, `BASE_RPC_URL`, `BSC_RPC_URL`, `SOL_RPC_URL`. |
| python-dotenv | bundled with pydantic-settings | `.env` file loading | pydantic-settings includes dotenv support — no separate install needed. |
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
## Installation
### Backend
### Frontend
# Add shadcn/ui
# Core components needed
## Architecture Notes for Roadmap
# payment_hash on result is the verification proof displayed in UI
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Crypto Token Analyzer**

A web-based tool that analyzes crypto tokens by contract address or ticker symbol, providing a letter-grade risk score (A–F) and technical analysis. All analysis runs through OpenGradient's TEE-verified LLM inference, producing cryptographic proof that the AI actually performed the analysis — displayed prominently as a core trust signal.

**Core Value:** Users can verify that the token analysis is real and untampered — the on-chain verification proof is the differentiator, not just the analysis itself.

### Constraints

- **Platform**: Must use OpenGradient for all LLM inference (via x402 HTTP gateway) — no direct API calls to OpenAI/Anthropic
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
| OpenGradient x402 HTTP gateway | — | TEE-verified LLM inference via HTTP + x402 payment protocol | All inference goes through OpenGradient. Using the x402 HTTP gateway instead of the Python SDK — compatible with TypeScript via `@x402/fetch`. |
| `og.TEE_LLM.CLAUDE_OPUS_4_6` | — | Primary analysis model | Strongest reasoning among available models for multi-step token risk analysis. GPT-5 is viable fallback. Set `temperature=0.0` for deterministic, auditable output. |
### Backend Framework (Next.js API Routes)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 22.x | Runtime | LTS version installed on dev machine. No Python available. |
| Next.js API Routes | 16.2.1 | Backend API layer | App Router API routes (`app/api/`) serve as the backend. No separate server process needed — single deployment unit. |
| `@x402/fetch` | latest | x402 payment-aware HTTP client | Wraps `fetch()` with automatic x402 payment header signing for OpenGradient inference calls. TypeScript-native. |
| `@x402/evm` | latest | EVM wallet client for x402 signing | Creates the wallet client that `@x402/fetch` uses to sign OPG payment headers on Base Sepolia. |
| `viem` | latest | EVM wallet and contract interaction | Lightweight TypeScript EVM library. Used both for x402 wallet client creation and for on-chain data reads (ERC-20 calls, contract inspection). Replaces web3.py. |
### EVM On-Chain Data (Ethereum, Base, BSC) — TypeScript
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `viem` | latest | EVM contract calls, event log scanning, token data | The modern TypeScript EVM library. Handles ERC-20 ABI calls (`totalSupply`, `balanceOf`, `Transfer` event logs), reading LP pool reserves from Uniswap V2/V3 pairs, and contract bytecode fetching. Replaces web3.py from the previous Python stack. |
- Ethereum: `https://mainnet.infura.io/v3/{KEY}` or Alchemy endpoint
- Base: `https://mainnet.base.org` (official, free, no key required)
- BSC: `https://bsc-dataseed.binance.org/` (official, free, no key required)
- ERC-20 metadata: `name()`, `symbol()`, `decimals()`, `totalSupply()`
- Contract bytecode via `eth.get_code()` — checks if contract is verified/non-proxy
- Top holder distribution: replay `Transfer` event logs, aggregate by address (resource-intensive — cap at last 10K blocks or use `getTokenLargestAccounts` equivalent pattern)
- Liquidity: query Uniswap V2 pair `getReserves()` for the token/WETH pair
- Transaction patterns: last N transactions to the contract via `eth_getLogs`
### Solana On-Chain Data (SPL Tokens) — TypeScript
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@solana/web3.js` | latest | Solana JSON-RPC client, SPL token program interaction | The official TypeScript Solana SDK. Provides `Connection` for RPC calls, SPL token account queries, and mint metadata. Replaces solana-py from the previous Python stack. |
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
| zod | latest | Env var validation | Type-safe environment variable validation at startup. Reads OG_PRIVATE_KEY, ETH_RPC_URL, BASE_RPC_URL, BSC_RPC_URL, SOL_RPC_URL. |
| .env.local | N/A | Env file loading | Next.js built-in .env.local support, no separate dotenv package needed. |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend framework | Next.js API Routes | Python/FastAPI | User has Node.js 22 but not Python. Separate backend adds deployment complexity. Next.js API routes provide a single TypeScript deployment unit. |
| Backend framework | Next.js API Routes | Express.js | Extra dependency when Next.js API routes handle the same use case natively with zero config. |
| EVM library | viem | ethers.js v6 | viem is lighter, tree-shakeable, and TypeScript-first. ethers.js v6 is viable but heavier. |
| Solana library | @solana/web3.js | solana-py + solders | Python stack no longer applicable. @solana/web3.js is the official TypeScript SDK. |
| Frontend | Next.js 16 | Pure Vite + React | No server-side rendering, no file-based routing, no built-in API proxy routes. Next.js handles all of this and is the dominant React framework. |
| Frontend | Next.js 16 | SvelteKit | Smaller ecosystem, fewer component libraries that include shadcn/ui-equivalent. Team likely more familiar with React. |
| Styling | Tailwind v4 + shadcn/ui | Material UI (MUI) | MUI ships heavy JS bundles and imposes Google Material design language. Tailwind + shadcn/ui produces lighter bundles and a more custom look appropriate for a crypto tool. |
| LLM model (primary) | Claude Opus 4.6 | Gemini 3 Pro | Gemini 3 Pro is less tested for strict JSON schema adherence in tool-calling loops. Claude Opus 4.6 is more reliable for structured output with complex instructions. |
| Config | zod env validation | t3-env | zod is already a dependency via shadcn/ui; t3-env adds another wrapper with minimal benefit. |
## Installation
### Full Stack (single Next.js project)
# npm install
# npx shadcn@latest init
# npx shadcn@latest add card badge input button
## Architecture Notes for Roadmap
# Next.js API routes serve as backend (no separate server)
# x402 HTTP gateway handles OpenGradient payment signing
# payment_hash on result is the verification proof displayed in UI
## Sources
- OpenGradient SDK reference: OPENGRADIENT_REFERENCE.md (local project file)
- x402 protocol: https://www.x402.org/ (HTTP payment protocol used for OpenGradient inference)
- viem docs: https://viem.sh/ (TypeScript EVM library)
- @solana/web3.js: https://solana-labs.github.io/solana-web3.js/
- Next.js 16.2 release: https://nextjs.org/blog/next-16-2 (March 18, 2026)
- Tailwind CSS v4 release: https://tailwindcss.com/blog/tailwindcss-v4 (January 22, 2025)
- shadcn/ui Next.js install: https://ui.shadcn.com/docs/installation/next
- Solana getTokenLargestAccounts: https://solana.com/docs/rpc/http/gettokenlargestaccounts
- Solana getTokenSupply: https://solana.com/docs/rpc/http/gettokensupply
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

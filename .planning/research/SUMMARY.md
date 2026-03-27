# Project Research Summary

**Project:** Crypto Token Analyzer (OpenGradient TEE)
**Domain:** Crypto Token Security Analysis — Verifiable AI-powered risk scoring
**Researched:** 2026-03-27
**Confidence:** MEDIUM-HIGH (stack HIGH, features HIGH, architecture HIGH, pitfalls MEDIUM)

## Executive Summary

This project is a verifiable AI token risk analyzer: users submit a crypto token contract address, and the system returns an A–F risk grade backed by a cryptographic proof that the LLM inference ran inside a Trusted Execution Environment (TEE). The core differentiator is that proof — no competitor (TokenSniffer, GoPlus, RugCheck) offers TEE-verified analysis. All existing tools use deterministic rule-based heuristics; this project uses LLM reasoning with adaptive tool calling to pull targeted on-chain data, making it both more explainable and cryptographically auditable.

The recommended approach is a three-tier architecture: a Next.js 16 frontend, a FastAPI backend that owns all blockchain RPC calls and OpenGradient SDK orchestration, and the OpenGradient TEE network as the inference layer. The backend runs an agentic tool-calling loop in which Claude Opus 4.6 (via `og.TEE_LLM.CLAUDE_OPUS_4_6`) requests specific on-chain data as needed — holder concentration, LP depth, contract bytecode, transfer velocity — rather than a mass pre-fetch. The loop terminates in a final structured JSON response containing the grade, per-factor breakdown, and an on-chain settlement hash that serves as the verification proof.

The two dominant risks are architectural: first, the OpenGradient settlement hash and payment hash are different objects on different chains, and displaying the wrong one as the "verification proof" destroys the product's entire value proposition. Second, the agentic tool-calling loop has no built-in iteration cap, meaning an unbounded loop can drain OPG token balance and hang the user indefinitely. Both must be addressed by design before any LLM integration work begins, not as late fixes.

---

## Key Findings

### Recommended Stack

The backend is Python 3.12 with FastAPI 0.135.2 and the `opengradient==0.9.3` SDK. FastAPI is required (not Flask or Django) because the OpenGradient SDK is async-native and mixing sync frameworks with async inference calls creates event loop collisions. On-chain data comes from `web3.py==7.14.1` for EVM chains (Ethereum, Base, BSC) and `solana==0.36.11` + `solders==0.27.1` for Solana SPL tokens. The frontend is Next.js 16.2 with React 19, TypeScript 5, Tailwind CSS v4, and shadcn/ui components.

All versions are pinned and verified against PyPI and official release pages as of 2026-03-27. The only platform constraint with no alternative is `opengradient` — all LLM inference must route through this SDK to achieve TEE-verified settlement.

**Core technologies:**
- `opengradient==0.9.3`: TEE-verified LLM inference, tool calling, x402 payment — platform constraint, no alternative
- `og.TEE_LLM.CLAUDE_OPUS_4_6`: Primary analysis model — strongest structured output adherence for A–F grade schema
- `FastAPI==0.135.2`: Async REST API and orchestration layer — async-native, matches OpenGradient SDK's asyncio pattern
- `web3.py==7.14.1`: EVM on-chain data (Ethereum, Base, BSC) — 6+ years production track record, async-compatible in v7.x
- `solana==0.36.11` + `solders==0.27.1`: Solana SPL token data — official community SDK
- `Next.js 16.2`: Frontend with App Router, SSR, and dynamic routes for `/analysis/[txHash]`
- `Tailwind v4` + `shadcn/ui`: UI layer — CSS-first config, no heavy bundle, custom look appropriate for crypto tooling

**Critical version notes:**
- Python must be 3.12 (opengradient requires ≥3.10; 3.13 has compatibility gaps)
- web3.py must be v7.x for async compatibility (v6.x is sync-only)
- Tailwind v4 uses CSS-first config — no `tailwind.config.ts` file needed

### Expected Features

The competitive analysis against TokenSniffer, GoPlus, and RugCheck reveals a clear table-stakes floor that this project must meet to be credible, plus a short list of genuine differentiators that only an LLM-in-TEE approach can deliver.

**Must have (table stakes — all competitors have these):**
- Contract address input + chain detection (Ethereum, Base, BSC, Solana)
- Honeypot detection — #1 user concern, can I sell this token?
- Buy/sell tax display — trading viability signal
- Mint function and ownership status (renounced vs. held)
- Blacklist/whitelist function detection
- Liquidity depth and lock status
- Top holder concentration (top 10–20 wallets)
- Contract source code verification flag
- Proxy contract detection
- Risk grade/score + breakdown of contributing factors
- Response time under 30 seconds — users abandon slow tools

**Should have (differentiators only this project can offer):**
- TEE-verified analysis with on-chain settlement hash — no competitor has this
- Natural language explanation of each risk factor in plain English
- Letter grade A–F (more intuitive than raw flags or 0–100 numeric scores)
- Adaptive tool calling — LLM requests additional data mid-analysis when initial data is suspicious
- Cross-chain unified interface (EVM + Solana in one tool)
- Verifiable timestamp proving when the analysis ran

**Defer to v2+:**
- Solana-specific freeze/mint authority checks (after EVM is working)
- Multi-round adaptive tool calling (start single-pass, add iteration in v2)
- Advanced wash trading / transaction pattern detection (requires indexer-level data)
- Ticker-to-address resolution beyond a static lookup table

**Never build (confirmed anti-features):**
- Price predictions, real-time charts, portfolio tracking, social metrics
- External API data (CoinGecko, DexScreener, Etherscan) — breaks TEE-verifiability constraint
- User accounts, watchlists, or alerts

### Architecture Approach

The architecture is a clean three-tier separation where the browser never touches blockchain RPCs or the OpenGradient SDK. The FastAPI backend is the single orchestration layer: it owns chain detection, all RPC calls via web3.py/solana-py, the agentic LLM loop via the OpenGradient SDK, and response shaping. The frontend is a stateless display layer that renders the grade, per-factor breakdown, and a persistent verification badge pointing to the OpenGradient block explorer. This separation is non-negotiable — browser-side private key exposure and CORS issues with RPC endpoints make client-side blockchain calls architecturally unacceptable.

**Major components:**
1. **Chain Fetcher** — On-chain data retrieval per chain using web3.py (EVM) and solana-py (Solana); wrapped as tool schemas the LLM can invoke
2. **Analysis Orchestrator** — Agentic tool-calling loop: builds message history, dispatches tool calls back to Chain Fetcher, manages loop termination, parses structured JSON output
3. **OpenGradient SDK Layer** — Wraps `og.LLM` client, manages OPG approval, submits inference with `INDIVIDUAL_FULL` settlement, returns `tx_hash`
4. **Token Resolver** — Ticker → contract address lookup; chain detection from address format (0x-prefix = EVM, base58 = Solana)
5. **FastAPI Backend** — `POST /analyze` endpoint, request validation (Pydantic), SSE streaming for long-running analysis, error handling including HTTP 402
6. **React Frontend** — Input form with chain selector, loading state, results display with letter grade and verification badge linking to OpenGradient explorer

**Key patterns to follow:**
- Granular tools over monolithic tools: `get_holder_distribution`, `get_transfer_velocity`, `get_liquidity_depth` — not a single `get_token_data()`
- Minimal pre-fetch then LLM-driven tool calls: pass only metadata + bytecode initially, let the model request what it needs
- `await llm.chat()` directly in async FastAPI routes — never wrap in `asyncio.run()`
- Pre-process all on-chain numerics to human-readable form before the LLM sees them

### Critical Pitfalls

1. **TEE settlement hash vs. payment hash confusion** — `result.payment_hash` is a Base Sepolia payment transaction; the actual TEE attestation record settles asynchronously on the OpenGradient chain. Displaying the payment hash as "verification proof" is factually incorrect and breaks the product's core claim. Prevention: poll for settlement confirmation separately; link payment hash to `sepolia.basescan.org` and settlement hash to `explorer.opengradient.ai`.

2. **Unbounded agentic tool-calling loop** — Without a hard iteration cap, the LLM can call tools repeatedly, draining OPG tokens and hanging the user. Prevention: hard cap of 5 total tool invocations per analysis; deduplicate tool+argument combinations; 60-second wall-clock timeout.

3. **Unvalidated LLM structured output** — The LLM may return prose wrapping JSON, invalid grade values ("B+"), or missing fields. Silent failures can display an incorrect grade. Prevention: `temperature=0.0`; Pydantic validation of all parsed output; retry once on parse failure; explicit JSON schema in system prompt.

4. **asyncio.run() in a FastAPI async route** — The OpenGradient reference examples use `asyncio.run()` for standalone scripts. Copying this into an async route handler raises `RuntimeError: This event loop is already running`. Prevention: use `await llm.chat()` directly; initialize `og.LLM` client once at startup, not per-request.

5. **Ticker symbol ambiguity** — Multiple tokens share the same symbol across chains and within the same chain (scam clones). Silently resolving a ticker to one address and analyzing the wrong token destroys trust. Prevention: return a disambiguation list when a ticker resolves to multiple addresses; require explicit user confirmation before analysis.

---

## Implications for Roadmap

Research strongly suggests a bottom-up build order matching architectural dependencies. The Chain Fetcher must exist before the Orchestrator; the Orchestrator must work before the API; the API must have a stable contract before the frontend is built. Each phase should produce testable output before the next phase starts.

### Phase 1: Project Foundation and SDK Integration

**Rationale:** The OpenGradient SDK is the most novel and underdocumented component. De-risking it first — verifying that `llm.chat()` runs, that settlement occurs, and that a valid `tx_hash` is returned — prevents the worst-case scenario: discovering the SDK behaves differently than documented after the rest of the application is built around it.

**Delivers:** Working `og.LLM` client that can call Claude Opus 4.6 with `INDIVIDUAL_FULL` settlement and return a verified `tx_hash`. Verified understanding of payment hash vs. settlement hash distinction. Environment config with `OG_PRIVATE_KEY` validated at startup.

**Addresses:** TEE settlement hash pitfall (Pitfall 1), asyncio.run() pitfall (Pitfall 4), private key security (Pitfall 12), x402 payment error handling (Pitfall 15)

**Stack:** `opengradient==0.9.3`, `fastapi==0.135.2`, `pydantic-settings==2.13.1`, Python 3.12

### Phase 2: On-Chain Data Fetching Layer

**Rationale:** The Chain Fetcher is the foundation all subsequent phases depend on. It must be built and tested independently before being wired into the LLM tool-calling loop. Testing against known tokens (USDC, PEPE) provides ground truth for validation.

**Delivers:** Working EVM data fetching (web3.py: metadata, bytecode, top holders, LP reserves, recent transfers) and Solana data fetching (solana-py: mint info, top 20 holders via `getTokenLargestAccounts`, supply). Tool schemas wrapping each fetcher function.

**Addresses:** EVM RPC rate limit pitfalls (Pitfall 8), Solana 20-holder ceiling (Pitfall 9), proxy contract analysis (Pitfall 14), Solana metadata off-chain limitation (Pitfall 4), pre-processing numerics before LLM (Pitfall 10)

**Stack:** `web3.py==7.14.1`, `solana==0.36.11`, `solders==0.27.1`, `httpx==0.28.1`

### Phase 3: Analysis Orchestrator and LLM Integration

**Rationale:** With the SDK layer and Chain Fetcher both working independently, this phase wires them together into the agentic loop. System prompt engineering and structured output parsing are the primary risks here — both require iteration.

**Delivers:** Full tool-calling loop with hard 5-call iteration cap, structured A–F grade output parsed and validated by Pydantic, 60-second timeout, `temperature=0.0` inference, JSON schema enforcement in system prompt.

**Addresses:** Unbounded tool loop (Pitfall 2), unvalidated LLM output (Pitfall 3), LLM arithmetic on raw numbers (Pitfall 10)

**Stack:** OpenGradient SDK + FastAPI Analysis Orchestrator component

### Phase 4: Token Resolver and Input Handling

**Rationale:** Chain detection and ticker resolution are thin but contain a landmine (ticker ambiguity). Building this after the analysis core means the resolver feeds into a working system and edge cases are immediately testable end-to-end.

**Delivers:** EVM address validation and chain detection (requires explicit chain selection for 0x addresses), Solana base58 address detection, static ticker → contract address lookup table, disambiguation list for duplicate tickers.

**Addresses:** Ticker ambiguity (Pitfall 5), BSC/ETH address confusion (Pitfall 13)

### Phase 5: FastAPI Backend API and Streaming

**Rationale:** Once all backend components work individually, this phase assembles the full `POST /analyze` endpoint with proper request/response contracts. SSE streaming is included here because 15–45 second analysis time requires progressive feedback to avoid browser timeouts.

**Delivers:** `POST /analyze` with Pydantic request validation, SSE streaming response for progress updates, structured error handling (HTTP 402, RPC failures, parse failures), stable API contract for frontend.

**Addresses:** Long-running request UX, x402 error surfaces (Pitfall 15), OPG approval on startup vs. per-request (Pitfall 6)

### Phase 6: React Frontend

**Rationale:** Built last because it depends on a stable API contract. The frontend is primarily a display layer — the complexity lives in the backend. The verification badge is a first-class feature, not decoration.

**Delivers:** Token input form with chain selector, loading state with progress indication via SSE, letter grade display with color coding, per-factor breakdown in plain English, persistent "Verified by OpenGradient TEE" badge with correct explorer link (OpenGradient explorer for settlement hash, not Base Sepolia for payment hash).

**Addresses:** Wrong explorer link (Pitfall 11), proof link display (Pitfall 1 — UI side)

**Stack:** Next.js 16.2, React 19, TypeScript 5, Tailwind v4, shadcn/ui (`Card`, `Badge`, `Input`, `Button`, `Alert`)

### Phase Ordering Rationale

- Chain Fetcher before Orchestrator: tool schemas cannot be written without knowing what data is available
- Orchestrator before API: the API is a thin wrapper; building a wrapper before the thing it wraps is backwards
- API before Frontend: the frontend API contract must be stable or frontend work is thrown away
- SDK validation in Phase 1 (not embedded in Phase 3): the settlement hash architecture is sufficiently novel that it warrants isolation and explicit validation before anything depends on it
- Token Resolver in Phase 4 (not Phase 1): contract address input can exercise the full stack; ticker resolution is a convenience layer and its complexity (disambiguation) should not block core analysis validation

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (SDK Integration):** OpenGradient SDK is v0.9.3 with sparse community post-mortems. The exact field name for settlement hash (`transaction_hash` vs. `payment_hash`) requires validation against a live testnet call. Recommend a dedicated spike task before committing to the full phase plan.
- **Phase 3 (Orchestrator / System Prompt):** Prompt engineering for structured A–F output with tool calling is inherently iterative. Budget for multiple prompt revision cycles. The interaction between tool call results and context window size under `INDIVIDUAL_FULL` settlement is not well-documented.
- **Phase 5 (SSE Streaming):** FastAPI SSE with long-running async tool-calling loops needs validation — specifically whether the SSE stream remains open during the multi-turn LLM loop or requires a job queue + polling pattern instead.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Chain Fetcher):** web3.py and solana-py are well-documented with extensive community examples. ERC-20 calls and `getTokenLargestAccounts` are standard.
- **Phase 4 (Token Resolver):** Address format detection (0x prefix vs. base58) is trivial. Static ticker lookup is a JSON file.
- **Phase 6 (Frontend):** Next.js 16 + Tailwind v4 + shadcn/ui are mature, well-documented stacks.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against PyPI on 2026-03-27. Official release pages checked for Next.js 16.2, Tailwind v4. No version conflicts identified. |
| Features | HIGH | Based on live competitive analysis of TokenSniffer, GoPlus, RugCheck, DEXTools. Feature categories confirmed across multiple independent sources. |
| Architecture | HIGH | Three-tier pattern is well-established. OpenGradient-specific patterns confirmed from SDK reference and architecture docs. Anti-patterns explicitly documented. |
| Pitfalls | MEDIUM | OpenGradient is a new platform (v0.9.3). Several pitfalls are inferred from architectural analysis and analogous platforms rather than community post-mortems. The settlement hash vs. payment hash distinction is particularly high-risk because it is not emphasized in SDK introductory docs. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Settlement hash field name:** Both `result.payment_hash` and `completion.transaction_hash` appear in different parts of the OpenGradient documentation. The correct field for the TEE attestation settlement must be validated with a live testnet call in Phase 1. Do not assume either field without empirical verification.

- **OpenGradient explorer URL format:** The explorer URL `https://explorer.opengradient.ai/tx/{hash}` must be verified as a working link format on testnet before it is hardcoded in the frontend.

- **INDIVIDUAL_FULL settlement latency:** It is unclear how long after `llm.chat()` returns the settlement record appears on-chain. If latency is more than a few seconds, the frontend UX needs a "settlement pending" state rather than immediate proof display. This gap should be measured during Phase 1.

- **OPG token cost per analysis:** The cost per `INDIVIDUAL_FULL` inference call is not documented in publicly available sources. Phase 1 should record actual OPG spend per call to inform budget estimates for production.

- **Solana Token-2022 support:** SPL Token-2022 (the newer token standard) requires a separate RPC call with a different program ID. Whether the project needs to support Token-2022 tokens should be decided before Phase 2 Solana work begins.

---

## Sources

### Primary (HIGH confidence)
- OpenGradient SDK PyPI: https://pypi.org/project/opengradient/ — v0.9.3 verified
- OpenGradient Docs: https://docs.opengradient.ai/developers/sdk/llm — LLM API, settlement modes
- OpenGradient Architecture: https://docs.opengradient.ai/learn/architecture/ — TEE network design
- web3.py PyPI + docs: https://pypi.org/project/web3/ + https://web3py.readthedocs.io/ — v7.14.1 verified
- FastAPI PyPI: https://pypi.org/project/fastapi/ — v0.135.2 verified
- solana-py PyPI: https://pypi.org/project/solana/ — v0.36.11 verified
- solders PyPI: https://pypi.org/project/solders/ — v0.27.1 verified
- Next.js 16.2 release: https://nextjs.org/blog/next-16-2
- Tailwind v4 release: https://tailwindcss.com/blog/tailwindcss-v4
- shadcn/ui Next.js install: https://ui.shadcn.com/docs/installation/next
- Solana getTokenLargestAccounts RPC: https://solana.com/docs/rpc/http/gettokenlargestaccounts
- TokenSniffer API docs: https://tokensniffer.readme.io/reference/introduction
- GoPlus Security Token API: https://gopluslabs.io/token-security-api
- RugCheck.xyz competitive analysis: https://rugcheck.xyz/

### Secondary (MEDIUM confidence)
- OpenGradient x402 blog: https://www.opengradient.ai/blog/x402-opengradient-upgrade-trustless-verifiable-inference — x402 payment architecture
- Metaplex Token Metadata: https://developers.metaplex.com/token-metadata — Solana on-chain vs. off-chain metadata distinction
- LLM Tool-Calling Infinite Loops: https://medium.com/@komalbaparmar007/llm-tool-calling-in-production-rate-limits-retries-and-the-infinite-loop-failure-mode-you-must-2a1e2a1e84c8
- FastAPI Async Event Loop: https://github.com/fastapi/fastapi/discussions/8842 — asyncio.run() pitfall pattern
- QuickNode Token Scanner Overview 2026: https://www.quicknode.com/builders-guide/best/top-9-token-scanners-rug-checkers

### Tertiary (LOW confidence — needs validation)
- OpenGradient GitHub examples: https://github.com/OpenGradient/sdk — field name discrepancy (payment_hash vs. transaction_hash) needs live testnet validation
- Solana Token-2022 holder lookup: https://github.com/solana-labs/solana/issues/31923 — behavior may differ from standard SPL

---

*Research completed: 2026-03-27*
*Ready for roadmap: yes*

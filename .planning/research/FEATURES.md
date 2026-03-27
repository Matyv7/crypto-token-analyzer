# Feature Landscape

**Domain:** Crypto Token Security Analysis
**Project:** Crypto Token Analyzer (OpenGradient TEE-verified)
**Researched:** 2026-03-27
**Confidence:** HIGH (based on live product analysis of TokenSniffer, GoPlus, RugCheck, DEXTools)

---

## Context: What This Project Is and Isn't

This project is NOT a general-purpose token scanner. It is a **verifiable AI analysis tool** — the core
differentiator is that the LLM inference runs inside a TEE (Trusted Execution Environment) with
on-chain settlement proof, making the analysis cryptographically auditable. That shapes every feature
decision: features that cannot leverage this unique property should be deprioritized.

---

## Table Stakes

Features that users of token analysis tools already expect. Missing any of these causes users to
trust another tool instead.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Contract address input | Universal entry point for all tools | Low | Also support ticker lookup |
| Honeypot detection | #1 user concern — can I sell this token? | Medium | Simulate buy + sell transactions; check for transfer restrictions |
| Buy/sell tax display | Critical for trading viability; >10% is high-risk, >50% often untradeable | Medium | Read from contract or simulate swap |
| Mint function detection | Owner can inflate supply and dump | Low | Static analysis of contract functions |
| Ownership status (renounced or held) | Held ownership = owner can change rules anytime | Low | Call `owner()` or equivalent; check if zero address |
| Blacklist/whitelist function detection | Owner can block wallets from selling | Low | Static contract analysis |
| Liquidity depth | How much can be withdrawn before price collapses | Medium | Read LP pool reserves on-chain |
| Liquidity lock status | Unlocked LP = instant rug pull risk | Medium | Check LP token holder — locker contracts vs. dev wallet |
| Top holder concentration | Top 10 wallets holding >50% = dump risk | Medium | Fetch holder list from RPC or transfer events |
| Contract source code verification | Unverified = can't audit what it does | Low | Check Etherscan/BSCScan/Solana explorer verified flag |
| Proxy contract flag | Upgradeable contracts can change behavior silently | Low | Check EIP-1967 slots or `implementation()` function |
| Multi-chain support | Tokens exist on ETH, BSC, Base, Solana | High | Different RPC, different ABIs, different patterns |
| Risk score / grade | Users need a single summary signal, not raw data | Medium | Requires synthesis logic (LLM is ideal here) |
| Breakdown of risk factors | Grade alone is not enough; users need to understand why | Medium | Per-category subscores or flags |
| Speed (under 30 seconds) | Users abandon tools that feel slow | High | Parallel data fetching; LLM call is the bottleneck |

---

## Differentiators

Features that set this product apart from the existing landscape. These are where OpenGradient's
capabilities create genuine competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| TEE-verified AI analysis | Cryptographic proof that a real LLM produced the analysis, not a human or cached result | Medium (OpenGradient SDK handles this) | No competitor has this — TokenSniffer, GoPlus, RugCheck all use rule-based heuristics |
| On-chain settlement hash | User can click a link and independently verify the analysis exists on-chain | Low | `result.payment_hash` from OpenGradient SDK; link to block explorer |
| Natural language explanation | LLM produces human-readable narrative, not just flags | Low (falls out of using LLM) | "This contract has a hidden mint function that was used 3 times in the past week" is more useful than a red icon |
| Adaptive tool calling during analysis | LLM can request additional on-chain lookups mid-analysis if initial data reveals something suspicious | High | Requires well-designed tool set and prompt engineering |
| Letter grade (A through F) | More intuitive than numeric scores (GoPlus uses raw flags, TokenSniffer uses 0-100) | Low | Familiar academic metaphor; maps well to risk levels |
| Explanation of each risk factor in plain English | Existing tools show "BLACKLIST: YES" with no context; LLM can explain what that actually means for the user | Low | Leverages LLM strengths |
| Cross-chain unified interface | Single UI for EVM (ETH/Base/BSC) and Solana (SPL) | High | Most tools are chain-specific: RugCheck is Solana-only, GoPlus is EVM-focused |
| Verifiable timestamp of analysis | Settlement hash proves *when* the analysis ran, not just what it said | Low | Important if token state changes after analysis |

---

## Anti-Features

Features to deliberately NOT build in v1. These would dilute focus, add complexity, or contradict
the project's core value proposition.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Price predictions / trading signals | Not what risk analysis is; invites regulatory scrutiny; impossible to verify correctly | Clearly label output as risk analysis, not investment advice |
| Real-time price charts | DEXTools already does this better; not verifiable on-chain without external price feeds | Out of scope — direct users to DEXTools/DexScreener for price |
| Portfolio tracking / watchlists | Requires user accounts, persistent state, significant infrastructure | Single-token stateless analysis is the v1 constraint |
| Historical trend tracking | Point-in-time snapshot is more trustworthy (less data quality risk); trend data needs indexers | Timestamp the analysis, note it is a snapshot |
| Social media metrics | Twitter followers, Telegram member counts are easily manipulated; not on-chain | Explicitly tell users this tool does not analyze social metrics |
| External API data (CoinGecko, DexScreener, Etherscan) | Breaks the "verifiable on-chain data only" constraint; third-party data cannot be TEE-verified | Fetch all data directly from chain RPCs inside tool calls |
| Automatic alerts / monitoring | Requires always-on infrastructure, user accounts, notification systems | Out of scope for v1 |
| Comparison between tokens | Adds UI/UX complexity; not the core use case | One token at a time is sufficient |
| PDF/report export | Nice-to-have, not critical; adds frontend complexity | On-screen display + copyable settlement hash is sufficient |
| Token whitelisting / known-safe lists | Becomes a maintenance burden; creates false confidence | Let every token be analyzed on its own merits |
| Paid tiers or subscription gating | Adds user onboarding friction; distracts from showcasing OpenGradient | Single per-analysis payment via x402 is cleaner |

---

## Feature Dependencies

```
Contract address input
  → Chain resolution (which RPC to use)
    → On-chain data fetching (contract code, LP pool, holders, transactions)
      → LLM tool calling (adaptive additional fetches)
        → TEE-verified LLM analysis
          → Risk grade (A-F) + explanation
            → On-chain settlement (Individual Full mode)
              → Settlement hash display + block explorer link

Ticker input
  → Ticker-to-contract resolution
    → (same as contract address input above)
```

**Critical path:** The entire analysis chain gates on on-chain data fetching. If chain RPC calls
are slow or data is incomplete, the LLM cannot produce a reliable grade. Data fetching quality
is the primary risk for the core experience.

**Secondary dependency:** The settlement hash display depends on Individual Full settlement completing
successfully. This is the OpenGradient x402 payment gateway and needs the wallet to have OPG tokens
funded (testnet faucet in dev, real tokens in prod).

---

## Feature Gap Analysis vs. Competitors

| Check | TokenSniffer | GoPlus | RugCheck (Solana) | This Project |
|-------|-------------|--------|-------------------|-------------|
| Honeypot detection | Yes | Yes | Yes | Yes (via simulation tool call) |
| Buy/sell tax | Yes | Yes | Yes | Yes |
| Mint function | Yes | Yes | Yes | Yes |
| Ownership status | Yes | Yes | Yes | Yes |
| Blacklist function | Yes | Yes | Partial | Yes |
| Liquidity lock | Yes | Partial | Yes | Yes |
| Holder concentration | Yes | Partial | Yes | Yes |
| Source code verified | Yes | Yes | N/A (Solana) | Yes |
| Proxy contract | Yes | Yes | No | Yes |
| Natural language explanation | No | No | No | **Yes (LLM)** |
| Letter grade (A-F) | Partial (score) | No (raw flags) | Risk label | **Yes** |
| Verifiable proof of analysis | No | No | No | **Yes (TEE + settlement hash)** |
| Multi-chain (EVM + Solana) | ETH/BSC/15 chains | 40+ chains | Solana only | ETH, Base, BSC, Solana |
| Adaptive follow-up analysis | No | No | No | **Yes (tool calling)** |

**Where this project wins:** Verifiable proof, natural language reasoning, letter grade, adaptive analysis.
**Where this project matches:** All table stakes security checks.
**Where this project is weaker:** Chain breadth (GoPlus covers 40+ chains vs. our 4).

---

## MVP Recommendation

**Build these in priority order:**

1. Contract address input + chain detection (ETH, Base, BSC, Solana)
2. On-chain data fetching tools: contract code, LP reserves, holder distribution, tax simulation
3. LLM analysis via OpenGradient TEE with tool calling
4. Letter grade (A-F) output with per-factor breakdown in plain English
5. Settlement hash display with block explorer link
6. Ticker-to-address resolution

**Defer to post-MVP:**
- Solana-specific checks (freeze authority, mint authority) — implement after EVM is working
- Adaptive tool calling (multiple rounds of LLM-initiated fetches) — start with single-pass, add iteration in v2
- Advanced wash trading / transaction pattern detection — complex, requires indexer-level data

**Never build (anti-features confirmed):**
- Price charts, portfolio tracking, social metrics, external API data

---

## Sources

- [TokenSniffer API Documentation](https://tokensniffer.readme.io/reference/introduction) — confirmed check categories: honeypot, mint, fees, blocklists, proxy, ownership, liquidity, holders
- [GoPlus Security — Token Security API](https://gopluslabs.io/token-security-api) — confirmed checks: honeypot, taxes, blacklist, whitelist, mint, proxy, trading cooldown
- [GoPlus Token Risk Classification](https://whitepaper.gopluslabs.io/goplus-network/user-security-network/security-data-layer/token-risk-classification) — risk classification methodology
- [RugCheck.xyz — Solana Token Checker](https://rugcheck.xyz/) — Solana-specific: mint/freeze authority, LP lock, holder distribution
- [DEXTools DEXT Score Methodology](https://dextools.medium.com/comments-and-tips-about-dext-score-7f6cfd628ee2) — social info, liquidity, transactions, holders, contract creation
- [QuickNode — Top 9 Token Scanners & Rug Checkers 2026](https://www.quicknode.com/builders-guide/best/top-9-token-scanners-rug-checkers) — ecosystem overview
- [DEXTools — How to Spot a Rug Pull 2026](https://www.dextools.io/news/news/how-to-spot-a-rug-pull-2026-checklist) — rug pull detection checklist
- [Honeypot.is — Detection Methodology](https://honeypot.is/) — transaction simulation for honeypot detection
- [DEXTools — Best Free Tools to Analyze Smart Contracts](https://www.dextools.io/tutorials/best-free-tools-analyze-smart-contracts) — competitive landscape overview
- [RugCheck Solana Guide](https://theblock101.com/solana-rug-checker) — Solana-specific analysis patterns

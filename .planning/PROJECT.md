# Crypto Token Analyzer

## What This Is

A web-based tool that analyzes crypto tokens by contract address or ticker symbol, providing a letter-grade risk score (A–F) and technical analysis. All analysis runs through OpenGradient's TEE-verified LLM inference, producing cryptographic proof that the AI actually performed the analysis — displayed prominently as a core trust signal.

## Core Value

Users can verify that the token analysis is real and untampered — the on-chain verification proof is the differentiator, not just the analysis itself.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can input a token contract address or ticker symbol
- [ ] System resolves ticker to contract address across supported chains
- [ ] System fetches on-chain token data (contract code, holders, transactions, liquidity)
- [ ] LLM analyzes token data via OpenGradient TEE-verified inference
- [ ] LLM uses tool calling to fetch additional on-chain data as needed
- [ ] User receives a letter-grade risk score (A through F) with breakdown
- [ ] User receives technical analysis (contract quality, holder distribution, liquidity depth, transaction patterns)
- [ ] Verification proof is displayed prominently with on-chain settlement hash
- [ ] User can click verification proof to view on-chain record
- [ ] Supports EVM chains: Ethereum, Base, BSC
- [ ] Supports Solana (SPL tokens)
- [ ] Web app UI with input field and results display
- [ ] Analysis results are settled on-chain via x402 (Individual Full mode)

### Out of Scope

- Price predictions or trading signals — this is risk analysis, not financial advice
- Portfolio tracking or watchlists — single token analysis only for v1
- Historical analysis or trend tracking — point-in-time snapshot only
- External API data (CoinGecko, DexScreener) — on-chain data only
- User accounts or saved analyses — stateless for v1
- Mobile app — web-first

## Context

- Built on OpenGradient platform (Python SDK `opengradient`)
- LLM inference runs inside TEE (Trusted Execution Environment) for verifiable AI
- Payment via x402 gateway on Base Sepolia (OPG tokens)
- Available LLM models: GPT-5, Claude Opus 4.6, Gemini 3 Pro, Grok-4 (all via `og.TEE_LLM` enum)
- Tool calling supported — LLM can invoke functions to fetch on-chain data during analysis
- Settlement modes: Private, Individual Full (chosen for audit trail), Batch Hashed
- OpenGradient Testnet: RPC `https://ogevmdevnet.opengradient.ai`, Chain ID 10740
- Base Sepolia: Chain ID 84532, OPG Token `0x240b09731D96979f50B2C649C9CE10FcF9C7987F`
- Block Explorer: `https://explorer.opengradient.ai/`
- Faucet: `https://faucet.opengradient.ai/`

## Constraints

- **Platform**: Must use OpenGradient SDK for all LLM inference — no direct API calls to OpenAI/Anthropic
- **Data**: On-chain data only — no external price APIs
- **Payment**: x402 gateway with OPG tokens on Base Sepolia (testnet)
- **Verification**: Individual Full settlement mode for complete on-chain audit trail
- **Chains**: Must support Ethereum, Base, BSC (EVM) and Solana (SPL)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenGradient TEE for all inference | Verification proof is the core differentiator | — Pending |
| On-chain data only (no external APIs) | Keeps data verifiable and trustworthy | — Pending |
| Letter grade (A–F) risk scoring | Intuitive, familiar format for users | — Pending |
| Individual Full settlement mode | Complete on-chain audit trail for each analysis | — Pending |
| Web app interface | Accessible to non-technical users | — Pending |
| Multi-chain (EVM + Solana) | Covers majority of token ecosystem | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after initialization*

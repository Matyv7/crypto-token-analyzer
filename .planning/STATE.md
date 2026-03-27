# Project State: Crypto Token Analyzer

**Last updated:** 2026-03-27
**Updated by:** Roadmap creation

---

## Project Reference

**Core value:** Users can verify that the token analysis is real and untampered — the on-chain verification proof is the differentiator.
**Current milestone:** M1 — Initial Delivery
**Current focus:** Phase 1 (SDK Foundation)

---

## Current Position

**Phase:** 1 — SDK Foundation
**Plan:** None yet (use `/gsd:plan-phase 1` to generate)
**Status:** Not started
**Overall progress:** 0/4 phases complete

```
[Phase 1: SDK Foundation      ] [ ]
[Phase 2: Data and Input Layer] [ ]
[Phase 3: Analysis Engine     ] [ ]
[Phase 4: Frontend and API    ] [ ]
```

Progress: 0% (0/4 phases)

---

## Performance Metrics

**Plans completed:** 0
**Tasks completed:** 0
**Phases completed:** 0
**Revisions needed:** 0

---

## Accumulated Context

### Key Decisions Made

| Decision | Rationale | Phase |
|----------|-----------|-------|
| 4-phase structure (coarse granularity) | Compress 6 research-suggested phases into natural delivery boundaries | Roadmap |
| ANLYS + INPT grouped in Phase 2 | Both are data/input concerns with no LLM dependency | Roadmap |
| VERF-01 deferred to Phase 3 | The proof badge requires the analysis loop to exist before it can be generated | Roadmap |

### Critical Facts to Remember

- The settlement hash and payment hash are DIFFERENT objects on DIFFERENT chains. Settlement hash goes to `explorer.opengradient.ai`; payment hash goes to `sepolia.basescan.org`. Getting this wrong destroys the product's core value claim.
- Agentic tool-calling loop MUST have a hard cap of 5 tool invocations and a 60-second wall-clock timeout. No exceptions.
- Never use `asyncio.run()` inside a FastAPI async route — use `await llm.chat()` directly.
- The correct field name for the TEE settlement hash is UNKNOWN until a live testnet call is made in Phase 1. Do not assume `result.payment_hash` or `completion.transaction_hash` without empirical verification.
- LLM temperature must be `0.0` for structured output. All parsed output must go through Pydantic validation.
- Ticker symbols resolve to multiple tokens (scam clones). Always return a disambiguation list; never silently pick one.

### Research Flags (Items Needing Validation in Specific Phases)

- **Phase 1:** Exact field name for TEE settlement hash (live testnet call required). INDIVIDUAL_FULL settlement latency. OPG cost per analysis call.
- **Phase 3:** Prompt engineering for A–F structured output with tool calling. Context window behavior under INDIVIDUAL_FULL mode.
- **Phase 4:** Whether SSE streaming stays open during multi-turn LLM loop, or whether a job queue + polling pattern is needed.

### Open TODOs

- None yet — project not started

### Blockers

- None

---

## Session Continuity

**To resume:** Read this file, read `.planning/ROADMAP.md`, then run `/gsd:plan-phase 1`
**Last action:** Roadmap created, all 21 v1 requirements mapped across 4 phases
**Next action:** Plan Phase 1 — `/gsd:plan-phase 1`

---

*State initialized: 2026-03-27*

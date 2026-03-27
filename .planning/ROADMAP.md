# Roadmap: Crypto Token Analyzer

**Milestone:** M1 — Initial Delivery
**Granularity:** Coarse
**Created:** 2026-03-27
**Coverage:** 21/21 v1 requirements mapped

---

## Phases

- [ ] **Phase 1: SDK Foundation** - OpenGradient TEE SDK validated, settlement hash architecture confirmed
- [ ] **Phase 2: Data and Input Layer** - All on-chain data fetchers working, input validation and resolution complete
- [ ] **Phase 3: Analysis Engine** - Full LLM analysis loop producing A–F grades with TEE verification proofs
- [ ] **Phase 4: Frontend and API** - Complete web application users can interact with

---

## Phase Details

### Phase 1: SDK Foundation
**Goal**: The OpenGradient TEE SDK is working end-to-end with confirmed settlement hash behavior
**Depends on**: Nothing
**Requirements**: VERF-02, VERF-03
**Success Criteria** (what must be TRUE):
  1. A live `llm.chat()` call via `og.TEE_LLM.CLAUDE_OPUS_4_6` completes without error and returns a response
  2. The correct settlement hash field (distinct from the payment hash) is identified and confirmed against the OpenGradient block explorer
  3. `INDIVIDUAL_FULL` settlement mode produces an on-chain record visible at `explorer.opengradient.ai`
  4. Private key and OPG approval flow work at startup with a running FastAPI app
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — FastAPI skeleton + live SDK smoke test (settlement hash field discovery)

### Phase 2: Data and Input Layer
**Goal**: All on-chain data needed for analysis can be fetched, and any valid token input resolves to a contract address
**Depends on**: Phase 1
**Requirements**: ANLYS-01, ANLYS-02, ANLYS-03, ANLYS-04, ANLYS-05, ANLYS-06, ANLYS-07, ANLYS-08, INPT-01, INPT-02, INPT-03, INPT-04
**Success Criteria** (what must be TRUE):
  1. Given a known EVM contract address (e.g., USDC on Ethereum), the system returns honeypot status, buy/sell tax, mint function presence, ownership status, blacklist/whitelist functions, source code verification flag, top holder percentages, and LP depth
  2. Given a Solana or EVM address, the system auto-detects the chain from address format without user selecting a chain
  3. Given a ticker symbol (e.g., "PEPE"), the system returns a list of matching contract addresses for user disambiguation
  4. The system rejects malformed inputs with a clear error before any RPC call is made
**Plans**: TBD
**UI hint**: no

### Phase 3: Analysis Engine
**Goal**: Users receive a complete A–F risk grade with per-factor breakdown and a TEE verification proof for any analyzed token
**Depends on**: Phase 2
**Requirements**: RISK-01, RISK-02, RISK-03, VERF-01
**Success Criteria** (what must be TRUE):
  1. Submitting a known scam token returns a grade of D or F with at least two contributing risk factors identified
  2. Submitting a known legitimate token (e.g., USDC) returns a grade of A or B with natural language explanation of each factor
  3. The LLM tool-calling loop terminates within 5 tool invocations and within 60 seconds regardless of token type
  4. The structured output (grade, per-factor breakdown, explanation text) passes Pydantic validation on every call with no silent failures
  5. The TEE verification proof badge data (settlement hash, explorer link) is present in the analysis result object
**Plans**: TBD

### Phase 4: Frontend and API
**Goal**: A user with a browser can analyze any supported EVM token and see the grade, breakdown, and verification proof without touching a terminal
**Depends on**: Phase 3
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. A user pastes a contract address into the web input field, clicks Analyze, and receives results within 45 seconds
  2. The results page clearly shows the letter grade (A–F with color coding), per-factor breakdown with plain English explanations, and a "Verified by OpenGradient TEE" badge
  3. The verification badge links to the correct OpenGradient block explorer URL (not the Base Sepolia payment transaction)
  4. A progress indicator is visible during the 15–45 second analysis window so the user knows the system is working
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. SDK Foundation | 0/1 | Planning complete | - |
| 2. Data and Input Layer | 0/? | Not started | - |
| 3. Analysis Engine | 0/? | Not started | - |
| 4. Frontend and API | 0/? | Not started | - |

---

*Roadmap created: 2026-03-27*
*Last updated: 2026-03-27 after Phase 1 planning*

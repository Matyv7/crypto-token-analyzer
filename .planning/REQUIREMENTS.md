# Requirements: Crypto Token Analyzer

**Defined:** 2026-03-27
**Core Value:** Users can verify that the token analysis is real and untampered — the on-chain verification proof is the differentiator.

## v1 Requirements

### Token Analysis

- [ ] **ANLYS-01**: System detects honeypot status (can the token be sold after buying)
- [ ] **ANLYS-02**: System detects buy/sell tax percentages
- [ ] **ANLYS-03**: System checks for mint function (can supply be inflated)
- [ ] **ANLYS-04**: System checks ownership status (renounced, multisig, EOA)
- [ ] **ANLYS-05**: System detects blacklist/whitelist functions in contract
- [ ] **ANLYS-06**: System checks if contract source code is verified
- [ ] **ANLYS-07**: System analyzes holder concentration (top 10 wallets %)
- [ ] **ANLYS-08**: System detects liquidity pools and measures depth

### Risk Scoring

- [ ] **RISK-01**: System produces letter grade A–F based on all analysis factors
- [ ] **RISK-02**: System provides per-factor risk breakdown with individual grades
- [ ] **RISK-03**: LLM generates natural language explanation for each risk factor

### Verification

- [ ] **VERF-01**: TEE verification proof badge displayed prominently on results
- [ ] **VERF-02**: Analysis runs through OpenGradient TEE-verified inference
- [ ] **VERF-03**: Settlement uses Individual Full mode for on-chain audit trail

### Input Handling

- [ ] **INPT-01**: User can paste a contract address to analyze
- [ ] **INPT-02**: System auto-detects chain from address format (EVM vs Solana)
- [ ] **INPT-03**: User can search by ticker symbol and pick from matching tokens
- [ ] **INPT-04**: Supports Ethereum, Base, and BSC chains

### Web Interface

- [ ] **UI-01**: Web app with token input field and results display
- [ ] **UI-02**: Results page shows risk grade, factor breakdown, and analysis text
- [ ] **UI-03**: Verification badge is visually prominent on results page

## v2 Requirements

### Extended Chains

- **CHAIN-01**: Solana SPL token support

### Advanced Analysis

- **ADV-01**: Adaptive tool calling — LLM requests more data mid-analysis
- **ADV-02**: Settlement hash clickable link to on-chain explorer
- **ADV-03**: Expandable TEE attestation details panel

## Out of Scope

| Feature | Reason |
|---------|--------|
| Price predictions / trading signals | Risk analysis tool, not financial advice |
| Portfolio tracking / watchlists | Single token analysis only for v1 |
| Historical trend analysis | Point-in-time snapshot only |
| External API data (CoinGecko, DexScreener) | On-chain data only constraint |
| User accounts / saved analyses | Stateless for v1 |
| Mobile app | Web-first |
| Solana support | Different architecture, deferred to v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ANLYS-01 | — | Pending |
| ANLYS-02 | — | Pending |
| ANLYS-03 | — | Pending |
| ANLYS-04 | — | Pending |
| ANLYS-05 | — | Pending |
| ANLYS-06 | — | Pending |
| ANLYS-07 | — | Pending |
| ANLYS-08 | — | Pending |
| RISK-01 | — | Pending |
| RISK-02 | — | Pending |
| RISK-03 | — | Pending |
| VERF-01 | — | Pending |
| VERF-02 | — | Pending |
| VERF-03 | — | Pending |
| INPT-01 | — | Pending |
| INPT-02 | — | Pending |
| INPT-03 | — | Pending |
| INPT-04 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 0
- Unmapped: 21 ⚠️

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after initial definition*

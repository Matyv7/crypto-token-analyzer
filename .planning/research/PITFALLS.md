# Domain Pitfalls

**Domain:** Crypto Token Analyzer — TEE-verified on-chain token risk analysis
**Researched:** 2026-03-27
**Confidence:** MEDIUM (OpenGradient is a new platform; some behaviors inferred from SDK reference and architectural docs rather than community post-mortems)

---

## Critical Pitfalls

Mistakes in this category cause rewrites, broken proofs, or silent incorrect analysis.

---

### Pitfall 1: TEE Settlement is Asynchronous — Payment Hash is Not the Proof

**What goes wrong:** The `result.payment_hash` returned by `llm.chat()` or `llm.completion()` is a Base Sepolia payment transaction hash, not the on-chain settlement record. The actual `INDIVIDUAL_FULL` settlement — containing input/output hashes and TEE attestation — is processed asynchronously by validators in a later consensus round. Displaying the payment hash to the user and calling it a "verification proof" is misleading and technically incorrect.

**Why it happens:** The SDK returns immediately after inference. The blockchain is not in the critical path of inference execution. Settlement confirmation arrives later.

**Consequences:** Users click the "verification proof" link and see a Base Sepolia payment transaction with no analysis data. The core trust differentiator of the product is broken. The product's entire value proposition collapses.

**Prevention:**
- Understand the two-hop architecture: payment hash (Base Sepolia) vs. settlement record (OpenGradient chain).
- Research the correct field in the result object for the OpenGradient settlement transaction hash.
- Poll or listen for the settlement confirmation separately before displaying the final proof link.
- Display the payment hash as "payment confirmed" and only display the settlement hash as the "verification proof" once available.
- Link to `https://explorer.opengradient.ai/` for settlement, not Base Sepolia explorer.

**Detection:** Try clicking your own verification proof link in development. If it shows a simple token transfer rather than inference input/output hashes, you have the wrong hash.

**Phase:** Must be resolved in the phase that implements settlement display (core proof UX).

---

### Pitfall 2: Tool Calling Agentic Loop Has No Termination Guard

**What goes wrong:** The LLM is given tools to fetch on-chain data (holders, transactions, contract code) and instructed to "gather what it needs." Without an explicit iteration cap, the LLM can call tools repeatedly — fetching the same data with slight variations, re-checking liquidity, re-fetching transactions — never producing a final analysis. Each tool call triggers a paid inference round via x402. Costs accumulate and the user sees a spinner forever.

**Why it happens:** LLMs in agentic loops are notorious for loop drift — calling the same tool with similar arguments repeatedly when they do not detect a clear stopping condition. The OpenGradient SDK does not impose an iteration limit.

**Consequences:** Analysis never completes. OPG token balance drains. User-facing request hangs or times out. Testnet faucet tokens exhausted during development.

**Prevention:**
- Enforce a hard `max_tool_calls` limit (recommend: 5 total tool invocations per analysis).
- Track which tool+argument combinations have already been called and reject duplicates.
- Design the system prompt to specify exactly which data to collect and stop after collecting it.
- Implement a timeout at the application layer (e.g., 60-second wall-clock limit per analysis).
- Structure the analysis in two phases: a single "data collection" pass (tool calls allowed), then a "synthesis" pass (no tools, only reasoning on collected data).

**Detection:** Log every tool call during development. If you see the same function called twice with identical or near-identical arguments, the loop guard is missing.

**Phase:** Must be designed into the tool-calling architecture phase before any multi-tool workflow is built.

---

### Pitfall 3: LLM Structured Output is Not Schema-Guaranteed Without Enforcement

**What goes wrong:** The analysis prompt asks the LLM to return a JSON object with `{ grade: "A-F", breakdown: {...}, summary: "..." }`. Sometimes the LLM returns: explanatory prose wrapping the JSON, a grade of "B+" instead of a valid enum value, missing fields, or a valid structure with hallucinated numeric values. Naive `json.loads(result.chat_output['content'])` crashes or silently produces incorrect grades.

**Why it happens:** Without constrained decoding or response schema enforcement, LLM output is probabilistic. Even with explicit instructions, models occasionally deviate — especially under temperature > 0 or when the context window fills with tool call results.

**Consequences:** Unhandled exceptions crash the analysis endpoint. Worse: silent failures where an invalid grade passes through and displays "C" for a token that deserved "F".

**Prevention:**
- Use `temperature=0.0` for all analysis calls to maximize determinism.
- Define the expected JSON schema explicitly in the system prompt with a literal example.
- Wrap all `json.loads` calls in try/except with fallback to a structured error state.
- Validate the parsed response against a Pydantic model before returning it to the frontend.
- If the grade is not in `["A", "B", "C", "D", "F"]`, reject the result and retry once.
- Consider asking the LLM to emit the grade on a dedicated line with a sentinel (e.g., `GRADE: C`) before the JSON, making extraction more robust.

**Detection:** Log raw LLM outputs during testing. Run 10+ analyses on the same token and check for variance in the output structure.

**Phase:** Address in the LLM integration phase. Never defer schema validation to a later phase.

---

### Pitfall 4: Solana Token Name/Symbol Are Off-Chain and May Be Unavailable

**What goes wrong:** The project requires resolving ticker symbols to contract addresses. For Solana SPL tokens, the name and symbol are stored in a Metaplex Token Metadata program-derived account, which itself contains a URI pointing to off-chain JSON (IPFS, Arweave, web server). If the off-chain URI is unreachable, stale, or returns 404, the token has no retrievable name or symbol from on-chain sources. This breaks ticker-to-address resolution and makes the analysis display incomplete.

**Why it happens:** The project constraint says "on-chain data only — no external APIs." But Solana token metadata partially lives off-chain by design. The on-chain metadata account stores the URI, not the full name/symbol (for extended metadata). Basic `name` and `symbol` fields in the metadata account are on-chain, but they are often empty for scam tokens or tokens that skipped Metaplex metadata entirely.

**Consequences:** Ticker lookup fails for many real tokens. Analysis display shows blank token names. The constraint "on-chain data only" may be impossible to fully honor for Solana token identity.

**Prevention:**
- Distinguish between what is truly on-chain (mint address, decimals, supply, freeze authority, mint authority) and what requires off-chain URI resolution (name, symbol, image).
- For EVM: name/symbol are on-chain via ERC-20 contract functions — this works reliably.
- For Solana: read the Metaplex metadata account for `name` and `symbol` fields (these are stored directly in the account, not behind the URI). Only the image and description require the URI.
- Implement graceful degradation: if name/symbol are unavailable, display "Unknown Token" + mint address.
- Do not attempt to resolve the off-chain URI — this violates the on-chain-only constraint and introduces external dependencies.

**Detection:** Test with a freshly-minted Solana token with no metadata set. Your resolver should not throw, it should return a graceful fallback.

**Phase:** Solana data layer phase.

---

### Pitfall 5: Duplicate Ticker Symbols Across Chains and Projects

**What goes wrong:** A user searches for "SHIB" intending to analyze Shiba Inu on Ethereum. The system finds multiple tokens named "SHIB" across Ethereum, BSC, and Base — plus dozens of scam tokens on each chain using the same symbol. The system picks one silently, analyzes the wrong token, and displays a result that looks legitimate. Worse: the scam token may score an "A" grade if the contract is clean but the project is fraudulent.

**Why it happens:** Ticker symbols are not unique identifiers in crypto. There is no registry. Multiple tokens legitimately share the same symbol across chains and sometimes on the same chain.

**Consequences:** Users make decisions based on analysis of the wrong token. Trust in the product is destroyed when a user discovers the analyzed token was not the one they intended.

**Prevention:**
- Never silently resolve a ticker to a single address without user confirmation.
- When a ticker maps to multiple addresses (across chains or on the same chain), return an disambiguation list to the user: "Found 3 tokens named SHIB — which one?" showing chain, contract address, liquidity, and age.
- Bias toward tokens with the highest liquidity as the default suggestion, but require explicit confirmation.
- Contract address input bypasses this problem entirely — encourage users who know the address to use it directly.
- Document this limitation prominently in the UI.

**Detection:** Search for "USDC" in your ticker resolver. It should return results on Ethereum, Base, and BSC — all different contract addresses.

**Phase:** Input/ticker resolution phase.

---

## Moderate Pitfalls

Mistakes in this category degrade quality, create confusion, or cause significant debugging time.

---

### Pitfall 6: OPG Approval Called on Every Request Wastes Time

**What goes wrong:** `llm.ensure_opg_approval(opg_amount=5.0)` is called at the start of every analysis request. This triggers an on-chain allowance check against Base Sepolia. If the approval is already sufficient, no transaction is sent. But the RPC call to check still takes 200-800ms and adds latency to every analysis.

**Prevention:**
- Call `ensure_opg_approval()` once at application startup, not per-request.
- Set a generous approval amount (e.g., 100 OPG) that covers many requests without re-approval.
- Cache the approval state in application memory with a TTL.

**Phase:** SDK setup / application initialization phase.

---

### Pitfall 7: asyncio.run() Blocks the Web Server Event Loop

**What goes wrong:** The OpenGradient SDK is fully async (`await llm.chat(...)`). The reference code uses `asyncio.run(llm.chat(...))` which creates a new event loop. In a FastAPI/ASGI web server, calling `asyncio.run()` inside an async route handler will raise `RuntimeError: This event loop is already running` and crash. In a sync route handler, it blocks the entire thread pool.

**Why it happens:** The SDK reference examples are standalone scripts, not web server code. Developers copy them directly into route handlers.

**Prevention:**
- In async FastAPI route handlers, use `await llm.chat(...)` directly — do not call `asyncio.run()`.
- In sync route handlers, use `asyncio.get_event_loop().run_until_complete()` or better: make the route async.
- Initialize the `og.LLM` client once at startup, not per-request.

**Detection:** Run two simultaneous analysis requests. If the second blocks until the first finishes, you have a blocking call in an async context.

**Phase:** Backend API setup phase.

---

### Pitfall 8: EVM RPC Rate Limits Silently Return Stale or Partial Data

**What goes wrong:** Fetching token data from Ethereum/BSC/Base requires multiple RPC calls: `eth_call` for name/symbol/supply, `eth_getLogs` for transfer history, and potentially `eth_getCode` for contract bytecode. Free public RPC endpoints (infura, alchemy free tier, public nodes) have per-second and per-day rate limits. Under load, they return HTTP 429 or silently return empty arrays for `eth_getLogs` without indicating truncation.

**Consequences:** The LLM receives incomplete data and produces analysis based on a partial picture. A token with 10,000 transfer events looks like it has 50 when logs are truncated. Holder concentration appears lower than it is.

**Prevention:**
- Always check for empty results in `eth_getLogs` and verify against `totalSupply` cross-check.
- Implement retry with exponential backoff for 429 responses.
- Set a explicit `fromBlock`/`toBlock` range rather than querying all history (limits response size).
- Use block-range chunking: fetch logs in 2000-block chunks rather than unbounded ranges.
- Treat any RPC call that returns an empty array as suspect — verify with a secondary call.

**Phase:** On-chain data fetching layer.

---

### Pitfall 9: Solana getTokenLargestAccounts Returns Only 20 Holders

**What goes wrong:** `getTokenLargestAccounts` is the correct RPC method for analyzing holder concentration on Solana. However, it returns only the top 20 token accounts by balance. For tokens with thousands of holders, this is sufficient for concentration analysis. But for new tokens with fewer than 20 holders, it may return all holders but appear to show 100% concentration — which could trigger false "high risk" scores.

**Prevention:**
- Pair `getTokenLargestAccounts` with `getTokenSupply` to calculate actual concentration percentages.
- Cross-check the number of total unique holders against the count returned — if fewer than 20 holders exist, concentration analysis is not meaningful ("new token, insufficient holder data").
- Do not infer total holder count from the 20-account list: use a separate method or note the limitation explicitly.
- Token-2022 tokens require a separate RPC call with the Token-2022 program ID — failure to check both programs produces incomplete holder data.

**Phase:** Solana data fetching layer.

---

### Pitfall 10: Treating the LLM as a Calculator for On-Chain Math

**What goes wrong:** The analysis prompt feeds raw numbers to the LLM (e.g., holder balances in wei, token supply as a uint256 bignum) and asks it to calculate concentration percentages. LLMs are unreliable at precise arithmetic, especially with large integers. The LLM may silently produce incorrect percentage calculations, leading to wrong risk scores.

**Prevention:**
- Never ask the LLM to perform arithmetic on raw on-chain values.
- Pre-process all data before passing it to the LLM: convert wei to tokens, compute percentages in Python, format holder counts as "Top holder owns 42.3% of supply."
- Pass summary statistics to the LLM, not raw numbers. The LLM's job is pattern recognition and reasoning, not computation.
- All numeric inputs to the LLM should already be in human-readable form with units.

**Phase:** Data preprocessing / LLM prompt design phase.

---

### Pitfall 11: Proof Link Points to Wrong Explorer

**What goes wrong:** The OpenGradient testnet has its own block explorer at `https://explorer.opengradient.ai/`. The payment transaction settles on Base Sepolia at `https://sepolia.basescan.org/`. Displaying the wrong explorer link for the wrong hash is confusing at best, broken at worst.

**Prevention:**
- Map each hash type to its correct explorer explicitly in code:
  - Payment hash → `https://sepolia.basescan.org/tx/{payment_hash}`
  - Settlement hash → `https://explorer.opengradient.ai/tx/{settlement_hash}`
- Never construct explorer URLs dynamically from a single "chain" variable — they are different chains.
- Add integration tests that verify the explorer URLs actually resolve to transaction pages.

**Phase:** Verification proof display phase.

---

## Minor Pitfalls

Small issues that are annoying but easy to fix once identified.

---

### Pitfall 12: Private Key Hardcoded or Logged

**What goes wrong:** The OpenGradient SDK requires a wallet private key (`OG_PRIVATE_KEY`) to sign payments. Developers hardcode it during testing and commit it to version control, or the key appears in application logs when debug logging captures all environment variables.

**Prevention:**
- Load exclusively from environment variable: `os.environ.get("OG_PRIVATE_KEY")`.
- Add `OG_PRIVATE_KEY` to `.gitignore` via `.env` file.
- Never log the private key or any object that contains it.
- Use a dedicated throwaway wallet for development — never the same key as any funded wallet.

**Phase:** Project setup phase (day one).

---

### Pitfall 13: BSC Contract Addresses Confused with Ethereum Addresses

**What goes wrong:** BSC (BNB Smart Chain) uses the same address format as Ethereum — both are 42-character hex strings starting with `0x`. A token contract address valid on Ethereum will be a different token (or no token) on BSC at the same address. Users who paste a BSC address into the analyzer without specifying BSC will receive analysis of the wrong contract (or an error for a non-existent contract).

**Prevention:**
- Always require explicit chain selection alongside contract address input.
- Do not attempt to auto-detect chain from address format for EVM chains — the formats are identical.
- If a contract does not exist on the user-specified chain, return a clear error: "No contract found at this address on [chain]."
- Solana addresses are base58-encoded and visually distinct — this pitfall is EVM-specific.

**Phase:** Input validation phase.

---

### Pitfall 14: Analysis Runs on a Proxy Contract, Not the Token Implementation

**What goes wrong:** Many EVM tokens use upgradeable proxy patterns (OpenZeppelin TransparentUpgradeableProxy, UUPS). The contract address the user provides points to the proxy, not the implementation. Fetching bytecode and running static analysis on the proxy yields minimal findings because the proxy itself contains almost no logic. The actual token logic lives at a separate implementation address resolvable via `eth_getStorageAt` with the EIP-1967 slot.

**Prevention:**
- When fetching contract bytecode for analysis, check for EIP-1967 implementation slot and resolve the actual implementation address.
- Include both the proxy address and implementation address in the analysis.
- The risk score should reflect the implementation contract's code, not the proxy.
- Note in the analysis output if a proxy was detected.

**Phase:** EVM contract analysis phase.

---

### Pitfall 15: x402 Payment Failures Surface as Cryptic Errors

**What goes wrong:** When the OPG token allowance is insufficient or the testnet wallet has insufficient funds, the x402 gateway returns HTTP 402. If this is not caught and handled explicitly, it propagates as an unhandled exception that either crashes silently or returns a 500 error to the user with no actionable message.

**Prevention:**
- Catch HTTP 402 responses from the OpenGradient LLM endpoint explicitly.
- Return a user-friendly message: "Analysis unavailable — testnet wallet needs OPG tokens. Visit faucet.opengradient.ai."
- Log the full 402 response body for debugging — it contains the payment requirements.
- Check wallet balance before initiating analysis (optional but improves UX).

**Phase:** SDK integration / error handling phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| SDK setup & wallet config | Private key in source / asyncio.run() in web handler | Use env vars; use `await` not `asyncio.run()` in async routes |
| Ticker → address resolution | Same symbol on multiple chains; scam tokens reusing symbols | Require chain selection; show disambiguation list |
| EVM data fetching | Rate limits silently truncating log history | Chunked block ranges; cross-check with totalSupply |
| Solana data fetching | Token-2022 missing from holder data; off-chain metadata URI | Two separate RPC calls per token program; graceful fallback for missing metadata |
| LLM tool calling loop | Infinite tool invocation burning OPG tokens | Hard cap at 5 tool calls; dedupe tool+args |
| LLM output parsing | Non-schema JSON, invalid grade values | temperature=0.0; Pydantic validation; retry once on parse failure |
| Numeric data feeding to LLM | Incorrect arithmetic on wei/bignum values | Pre-compute all percentages in Python before prompt |
| Proxy contract analysis | Analyzing proxy instead of implementation | Resolve EIP-1967 implementation slot |
| Settlement proof display | Payment hash displayed as verification proof | Understand two-hash architecture; poll for settlement hash separately |
| Explorer links | Wrong explorer for wrong hash | Hard-code explorer URLs per hash type; never derive dynamically |
| x402 payment errors | 402 surfaces as unhandled 500 | Explicit catch for HTTP 402; user-friendly error message |

---

## Sources

- OpenGradient Architecture Docs: https://docs.opengradient.ai/learn/architecture/
- OpenGradient LLM SDK Docs: https://docs.opengradient.ai/developers/sdk/llm
- x402 Security Risks: https://www.halborn.com/blog/post/x402-explained-security-risks-and-controls-for-http-402-micropayments
- LLM Tool-Calling Infinite Loops: https://medium.com/@komalbaparmar007/llm-tool-calling-in-production-rate-limits-retries-and-the-infinite-loop-failure-mode-you-must-2a1e2a1e84c8
- Solana Token Metadata (on-chain vs off-chain): https://developers.metaplex.com/token-metadata
- Solana Token-2022 Holder Lookup: https://github.com/solana-labs/solana/issues/31923
- Solana RPC Rate Limits and Optimization: https://www.helius.dev/docs/rpc/optimization-techniques
- EVM vs Solana Transaction Decoding Differences: https://dev.to/decoder_man/transaction-decoding-on-ethereum-evm-blockchains-vs-solana-a-technical-perspective-4kja
- Duplicate Ticker Symbol Problem: https://binance.com/en/blog/community/navigating-crypto-tickers-how-to-identify-the-correct-token-7224461660301014412
- LLM Structured Output Reliability: https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk
- FastAPI Async Event Loop Pitfalls: https://github.com/fastapi/fastapi/discussions/8842
- Rug Pull Detection Limitations: https://arxiv.org/html/2506.18398v3

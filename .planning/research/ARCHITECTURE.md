# Architecture Patterns

**Project:** Crypto Token Analyzer
**Researched:** 2026-03-27

---

## Recommended Architecture

A three-tier web application with a Python backend as the orchestration layer. The browser never touches blockchain RPCs or the OpenGradient SDK directly — all of that runs server-side where the private key and async tool-calling loop live.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React/TS)                        │
│  [ Token Input ] → [ Loading/Streaming State ] → [ Results UI ] │
│                     [ Verification Badge + TX Link ]             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP POST /analyze  (JSON)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Python)                       │
│                                                                  │
│  ┌────────────────┐    ┌──────────────────────────────────────┐ │
│  │ Token Resolver │    │        Analysis Orchestrator          │ │
│  │                │    │                                       │ │
│  │ ticker → addr  │───▶│  1. Build initial data payload        │ │
│  │ chain detect   │    │  2. Call og.LLM.chat(tools=[...])     │ │
│  └────────────────┘    │  3. Execute tool calls (loop)         │ │
│                        │  4. Return final result + tx_hash     │ │
│  ┌────────────────┐    └──────────────────────────────────────┘ │
│  │  Chain Fetcher │◀──────────── tool calls ───────────────────┤ │
│  │                │                                             │ │
│  │  EVM: web3.py  │    ┌──────────────────────────────────────┐ │
│  │  SOL: solana-py│    │       OpenGradient SDK Layer          │ │
│  │                │    │                                       │ │
│  │  - bytecode    │    │  og.LLM(private_key=OG_PRIVATE_KEY)   │ │
│  │  - holders     │    │  llm.chat(model, messages, tools,     │ │
│  │  - transfers   │    │          settlement_mode=INDIVIDUAL_  │ │
│  │  - liquidity   │    │          FULL)                        │ │
│  └────────────────┘    │                                       │ │
│                        │  Returns: chat_output, tx_hash        │ │
└────────────────────────┴──────────────────────────────────────-─┘
           │                            │
           ▼                            ▼
  ┌─────────────────┐        ┌──────────────────────────────────┐
  │  Blockchain RPCs │        │  OpenGradient TEE Network         │
  │                 │        │                                   │
  │  Ethereum RPC   │        │  - Inference inside secure        │
  │  Base RPC       │        │    enclave (TEE)                  │
  │  BSC RPC        │        │  - Signs output with enclave key  │
  │  Solana RPC     │        │  - Settles proof on-chain         │
  └─────────────────┘        │  - Returns tx_hash for explorer   │
                             └──────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **React Frontend** | User input, results display, verification badge, loading state | FastAPI Backend (HTTP) |
| **FastAPI Backend** | Request routing, response shaping, error handling | Analysis Orchestrator, Token Resolver |
| **Token Resolver** | Ticker → contract address lookup; chain detection from address prefix | Chain Fetcher (to validate address), static token lists |
| **Analysis Orchestrator** | Runs the agentic tool-calling loop with OpenGradient LLM | OpenGradient SDK, Chain Fetcher (via tool dispatch) |
| **Chain Fetcher** | On-chain data retrieval per chain (bytecode, holders, transfers, liquidity) | EVM RPCs via web3.py, Solana RPC via solana-py |
| **OpenGradient SDK Layer** | Wraps `og.LLM` client, manages OPG approval, submits inference with INDIVIDUAL_FULL settlement | OpenGradient TEE Network, Base Sepolia (x402 payment) |

---

## Data Flow

### Happy Path: Ticker Input

```
User enters "PEPE"
    │
    ▼
Frontend POST /analyze { input: "PEPE", chain: "ethereum" }
    │
    ▼
Token Resolver
    ├── Recognizes string without 0x → ticker mode
    ├── Looks up contract address (static list or on-chain registry)
    └── Returns { address: "0x6982...", chain: "ethereum" }
    │
    ▼
Chain Fetcher (initial pre-fetch)
    ├── ERC-20 metadata: name, symbol, decimals, total_supply
    ├── Contract bytecode (for ownership/mint function detection)
    ├── Top 20 holder accounts + balances
    └── Recent transfer events (last 500 blocks)
    │
    ▼
Analysis Orchestrator
    ├── Builds messages: [system_prompt, user_message_with_data]
    ├── Registers tool schemas: get_liquidity_data, get_contract_source,
    │   get_holder_concentration, get_transfer_velocity
    └── Calls og.LLM.chat(model, messages, tools, settlement_mode=INDIVIDUAL_FULL)
    │
    ▼
OpenGradient TEE — Tool Calling Loop
    ├── LLM requests: get_liquidity_data({ address, chain })
    │       └── Tool executed server-side → result appended to messages
    ├── LLM requests: get_holder_concentration({ address, chain })
    │       └── Tool executed server-side → result appended to messages
    └── LLM produces final analysis (no more tool calls)
    │
    ▼
OpenGradient returns
    ├── chat_output: { role: "assistant", content: "{ grade: 'C', ... }" }
    └── tx_hash (settlement hash on OpenGradient chain)
    │
    ▼
FastAPI shapes response
    └── { grade, analysis, proof_hash, explorer_url }
    │
    ▼
Frontend renders
    ├── Letter grade (A–F) with color
    ├── Analysis breakdown sections
    └── Verification badge: "Verified on-chain [tx_hash]" → links to explorer
```

### Happy Path: Contract Address Input

Same flow but Token Resolver skips ticker lookup — validates address format, detects chain from known address patterns or user-specified chain parameter.

---

## Tool Calling Loop — Implementation Pattern

The OpenGradient SDK passes tool schemas to the LLM in the first `chat()` call. The model returns either a final answer or a `tool_call` object. The orchestrator executes the tool, appends the result to the message history, and calls `chat()` again. This continues until the model stops requesting tools.

```python
# Pseudocode — agentic loop pattern
messages = [system_msg, initial_data_msg]
tools = [get_liquidity_schema, get_source_schema, get_holder_schema]

while True:
    result = await llm.chat(
        model=og.TEE_LLM.CLAUDE_OPUS_4_6,
        messages=messages,
        tools=tools,
        settlement_mode=og.x402SettlementMode.INDIVIDUAL_FULL
    )

    if result.chat_output.get("tool_calls"):
        for tool_call in result.chat_output["tool_calls"]:
            tool_result = dispatch_tool(tool_call)
            messages.append({"role": "tool", "content": tool_result, ...})
    else:
        # Final answer
        tx_hash = result.transaction_hash  # or result.payment_hash
        final_text = result.chat_output["content"]
        break
```

Note: The OpenGradient SDK's exact field name for the settlement hash requires validation at implementation time — both `transaction_hash` and `payment_hash` appear in different parts of the documentation. The OPENGRADIENT_REFERENCE.md examples use `result.payment_hash`, while GitHub examples use `completion.transaction_hash`. Treat whichever is populated as the on-chain proof reference.

---

## Chain Detection Logic

```
Input string analysis:
  ├── Starts with "0x" + 40 hex chars → EVM contract address
  │       └── Chain must be provided by user (dropdown) or detected from
  │           known token registries
  ├── Base58, 32–44 chars → Solana program address (SPL token mint)
  └── Anything else → Ticker symbol
            └── Query token resolver: static list + on-chain lookup
```

For EVM chains (Ethereum, Base, BSC), the same contract address can exist on multiple chains — require users to select chain when inputting an EVM address. Solana addresses are unambiguous.

---

## On-Chain Data Fetching — Per Chain

### EVM Chains (Ethereum, Base, BSC)

Library: `web3.py` (Python, async-compatible in v7.x)

| Data Point | Method | Notes |
|------------|--------|-------|
| Token metadata | `contract.functions.name/symbol/decimals/totalSupply().call()` | Needs ERC-20 ABI |
| Contract bytecode | `web3.eth.get_code(address)` | Check for proxy patterns |
| Top holders | `getLogs` on Transfer events → aggregate by recipient | Expensive; cap at recent N blocks |
| Recent transfers | `contract.events.Transfer.get_logs(from_block=...)` | Velocity signal |
| Liquidity (Uniswap) | Query Uniswap V2/V3 pair contracts directly | Requires known factory addresses |
| Contract source | Etherscan API (free tier) | Not purely on-chain but widely used |

RPC endpoints: Use public endpoints (Ethereum public RPC, Base public RPC, BSC public RPC) for testnet/demo. Add Infura/Alchemy support for production reliability.

### Solana (SPL Tokens)

Library: `solana-py` + `solders`

| Data Point | Method | Notes |
|------------|--------|-------|
| Token metadata | `get_account_info(mint_address)` | Metaplex metadata program |
| Top 20 holders | `get_token_largest_accounts(mint)` | Native RPC method, returns top 20 |
| All holders | `getProgramAccounts` with filters | Resource-intensive; use carefully |
| Recent transfers | Parse transaction history for token accounts | Complex; use Helius if needed |
| Mint authority | Parse mint account data | Checks if mint is frozen/revoked |

---

## Verification Display — Frontend Contract

The proof display is a first-class UI element, not an afterthought. The backend always returns:

```json
{
  "proof": {
    "tx_hash": "0xabc123...",
    "settlement_mode": "INDIVIDUAL_FULL",
    "explorer_url": "https://explorer.opengradient.ai/tx/0xabc123...",
    "verified": true
  },
  "grade": "C",
  "analysis": { ... }
}
```

The frontend renders a persistent "Verified by OpenGradient TEE" badge with the truncated hash and a clickable link. This is the core trust signal — not decorative.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fetching On-Chain Data from the Browser
**What:** Having the frontend call RPCs or the OpenGradient SDK directly via WebAssembly or a JS SDK.
**Why bad:** Exposes the private key in the browser. Creates CORS issues with RPC endpoints. Cannot run Python SDK.
**Instead:** All on-chain fetching and LLM calls happen server-side in the Python backend.

### Anti-Pattern 2: Pre-Fetching Everything Before LLM Call
**What:** Fetching all possible on-chain data (bytecode + holders + transfers + liquidity + source) before the first LLM call, passing a massive prompt.
**Why bad:** Most data may be irrelevant. Prompts become too large. Slow initial response.
**Instead:** Fetch minimal initial data (metadata, bytecode, top holders). Let the LLM use tools to pull additional data as needed — this is what tool calling is for.

### Anti-Pattern 3: One Tool That Returns Everything
**What:** A single `get_token_data(address)` tool that returns all data in one blob.
**Why bad:** The LLM cannot selectively request what it needs. Defeats the purpose of tool calling. Returns too much data in a single tool call.
**Instead:** Granular tools: `get_holder_distribution`, `get_transfer_velocity`, `get_liquidity_depth`, `get_contract_bytecode`. Let the model choose which it needs.

### Anti-Pattern 4: Synchronous Tool Execution Blocking the Request
**What:** Long-running chain fetches that hold the HTTP connection open for 30+ seconds.
**Why bad:** Browser timeout, poor UX, no feedback during analysis.
**Instead:** Stream the response via SSE (Server-Sent Events) or WebSocket, or use a job queue with polling. FastAPI supports SSE natively with `StreamingResponse`.

### Anti-Pattern 5: Treating tx_hash as Optional
**What:** Displaying analysis without the verification proof if `tx_hash` is missing.
**Why bad:** The verification is the core product differentiator. If it's missing, the whole value proposition collapses.
**Instead:** Fail the request if no tx_hash is returned. Display an error rather than unverified analysis.

---

## Scalability Considerations

| Concern | MVP (demo scale) | Production |
|---------|------------------|------------|
| RPC rate limits | Public free-tier RPCs | Infura/Alchemy with dedicated keys |
| Tool call latency | Sequential tool calls (simple) | Parallel tool calls where possible |
| Analysis time | 15–45 seconds acceptable | SSE streaming for perceived speed |
| Caching | No cache (stateless) | Cache analysis by (address+chain+block) for N minutes |
| OpenGradient costs | OPG testnet tokens (free from faucet) | Budget per-analysis OPG spend |

---

## Suggested Build Order

Dependencies flow from bottom to top. Build in this sequence:

1. **Chain Fetcher** (foundation — all other components depend on its output)
   - EVM data fetching with web3.py
   - Solana data fetching with solana-py
   - Tool schema definitions that wrap these fetchers
   - Test against known tokens (USDC, PEPE, etc.)

2. **OpenGradient SDK Layer** (enables the LLM step)
   - `og.LLM` client initialization
   - Single `llm.chat()` call without tools
   - Verify `tx_hash` is returned and links to explorer
   - Test INDIVIDUAL_FULL settlement mode

3. **Analysis Orchestrator** (combines chain fetcher + OG SDK)
   - Tool dispatch loop
   - Message history management
   - System prompt engineering for letter-grade output
   - Structured JSON output parsing from LLM

4. **Token Resolver** (thin layer, mostly lookup tables)
   - EVM address validation and chain detection
   - Solana address detection (base58)
   - Ticker lookup (static JSON map for MVP)

5. **FastAPI Backend** (wires everything together)
   - `POST /analyze` endpoint
   - Request validation (Pydantic)
   - Response shaping and error handling
   - SSE or async response for long-running analysis

6. **React Frontend** (depends on API contract being stable)
   - Input form (address/ticker + chain selector)
   - Loading state with progress indication
   - Results display: grade, breakdown, verification badge
   - Explorer link for tx_hash

---

## Sources

- OpenGradient Architecture: https://docs.opengradient.ai/learn/architecture/
- OpenGradient LLM SDK: https://docs.opengradient.ai/developers/sdk/llm
- OpenGradient SDK (PyPI): https://pypi.org/project/opengradient/
- OpenGradient GitHub: https://github.com/OpenGradient/sdk
- web3.py documentation: https://web3py.readthedocs.io/en/stable/web3.eth.html
- solana-py GitHub: https://github.com/michaelhly/solana-py
- Solana getTokenLargestAccounts: https://docs.chainstack.com/docs/solana-gettokenlargestaccounts-rpc-method
- FastAPI + React pattern: https://www.joshfinnie.com/blog/fastapi-and-react-in-2025/
- LLM Agent architecture: https://www.datacamp.com/blog/llm-agents
- Rug pull detection components: https://www.mdpi.com/2076-3417/15/1/450
- OpenGradient x402 verification blog: https://www.opengradient.ai/blog/x402-opengradient-upgrade-trustless-verifiable-inference

import { privateKeyToAccount } from "viem/accounts";

const OG_LLM_URL = "https://llm.opengradient.ai/v1/chat/completions";
const OG_EXPLORER_URL = "https://explorer.opengradient.ai/tx";
const OG_MODEL_HUB_URL = "https://hub.opengradient.ai";
const OG_DEVNET_RPC = "https://ogevmdevnet.opengradient.ai";

// TEE_LLM model identifiers — maps to og.TEE_LLM enum values
export const TEE_LLM = {
  CLAUDE_OPUS_4_6: "anthropic/claude-opus-4-6",
  GPT_5: "openai/gpt-5",
  GEMINI_3_PRO: "google/gemini-3-pro",
  GROK_4: "xai/grok-4",
} as const;

// x402SettlementMode — controls on-chain audit trail
export const x402SettlementMode = {
  PRIVATE: "private",
  INDIVIDUAL_FULL: "individual",
  BATCH_HASHED: "batch",
} as const;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OGChatOptions = {
  model?: string;
  model_cid?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  settlement_type?: "private" | "individual" | "batch";
};

export type OGChatResult = {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
  _raw: Record<string, unknown>;
  _headers: Record<string, string>;
  _mock: boolean;
  _settlementHash: string | null;
  _explorerUrl: string | null;
};

function getPrivateKey(): `0x${string}` | null {
  const key = process.env.OG_PRIVATE_KEY;
  if (!key) return null;
  return key as `0x${string}`;
}

async function tryX402Fetch(options: OGChatOptions): Promise<OGChatResult | null> {
  try {
    const key = getPrivateKey();
    if (!key) return null;

    const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
    const { registerExactEvmScheme } = await import("@x402/evm/exact/client");

    const account = privateKeyToAccount(key);
    const client = new x402Client();
    registerExactEvmScheme(client, {
      signer: account,
      networks: ["eip155:84532"],
    });
    const x402Fetch = wrapFetchWithPayment(fetch, client);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (options.settlement_type) {
      headers["X-SETTLEMENT-TYPE"] = options.settlement_type;
    }

    const response = await x402Fetch(OG_LLM_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: options.model ?? TEE_LLM.CLAUDE_OPUS_4_6,
        messages: options.messages,
        temperature: options.temperature ?? 0.0,
        max_tokens: options.max_tokens ?? 1000,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v: string, k: string) => { responseHeaders[k] = v; });

    // Extract settlement hash from response headers (X-PAYMENT-RESPONSE)
    const settlementHash = responseHeaders["x-payment-response"] || responseHeaders["x-settlement-hash"] || null;
    const explorerUrl = settlementHash ? `${OG_EXPLORER_URL}/${settlementHash}` : null;

    return { ...data, _raw: data, _headers: responseHeaders, _mock: false, _settlementHash: settlementHash, _explorerUrl: explorerUrl };
  } catch {
    return null;
  }
}

export async function ogChat(options: OGChatOptions): Promise<OGChatResult> {
  // Try real API first
  const realResult = await tryX402Fetch(options);
  if (realResult) return realResult;

  // Fall back to mock — extract the user message to create contextual mock
  const userMessage = options.messages.find(m => m.role === "user")?.content ?? "";
  const mockContent = userMessage; // The caller handles parsing

  return {
    choices: [{ message: { role: "assistant", content: mockContent }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0 },
    _raw: {},
    _headers: {},
    _mock: true,
    _settlementHash: null,
    _explorerUrl: null,
  };
}

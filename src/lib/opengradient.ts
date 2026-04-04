import { createPublicClient, http, parseAbi, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const OG_EXPLORER_URL = "https://explorer.opengradient.ai/tx";

// On-chain TEE registry on OpenGradient devnet
const OG_DEVNET_RPC = "https://ogevmdevnet.opengradient.ai";
const TEE_REGISTRY_ADDRESS = "0x4e72238852f3c918f4E4e57AeC9280dDB0c80248" as Address;
const TEE_TYPE_LLM_PROXY = 0;

const TEE_REGISTRY_ABI = parseAbi([
  "function getActiveTEEs(uint8 teeType) view returns ((address owner, address paymentAddress, string endpoint, bytes publicKey, bytes tlsCertificate, bytes32 pcrHash, uint8 teeType, bool enabled, uint256 registeredAt, uint256 lastHeartbeatAt)[])",
]);

// Placeholder API key required by x402 protocol
const X402_PLACEHOLDER_API_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

// TEE_LLM model identifiers — maps to og.TEE_LLM enum values
export const TEE_LLM = {
  // Anthropic
  CLAUDE_OPUS_4_6: "anthropic/claude-opus-4-6",
  CLAUDE_OPUS_4_5: "anthropic/claude-opus-4-5",
  CLAUDE_SONNET_4_6: "anthropic/claude-sonnet-4-6",
  CLAUDE_SONNET_4_5: "anthropic/claude-sonnet-4-5",
  CLAUDE_HAIKU_4_5: "anthropic/claude-haiku-4-5",
  // OpenAI
  GPT_5: "openai/gpt-5",
  GPT_5_2: "openai/gpt-5-2",
  GPT_5_MINI: "openai/gpt-5-mini",
  GPT_4_1: "openai/gpt-4.1-2025-04-14",
  O4_MINI: "openai/o4-mini",
  // Google
  GEMINI_3_PRO: "google/gemini-3-pro",
  GEMINI_3_FLASH: "google/gemini-3-flash",
  GEMINI_2_5_PRO: "google/gemini-2.5-pro",
  GEMINI_2_5_FLASH: "google/gemini-2.5-flash",
  // xAI
  GROK_4: "xai/grok-4",
  GROK_4_FAST: "xai/grok-4-fast",
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
  _teeEndpoint: string | null;
};

// Cache resolved TEE endpoint for 5 minutes
let cachedTeeEndpoint: { url: string; resolvedAt: number } | null = null;
const TEE_CACHE_TTL = 5 * 60 * 1000;

async function resolveTeeEndpoint(): Promise<string | null> {
  if (cachedTeeEndpoint && Date.now() - cachedTeeEndpoint.resolvedAt < TEE_CACHE_TTL) {
    return cachedTeeEndpoint.url;
  }

  try {
    const registryClient = createPublicClient({ transport: http(OG_DEVNET_RPC, { timeout: 10_000 }) });
    const tees = await registryClient.readContract({
      address: TEE_REGISTRY_ADDRESS,
      abi: TEE_REGISTRY_ABI,
      functionName: "getActiveTEEs",
      args: [TEE_TYPE_LLM_PROXY],
    });

    if (!tees || tees.length === 0) return null;

    // Pick a random active TEE
    const tee = tees[Math.floor(Math.random() * tees.length)];
    const endpoint = tee.endpoint;

    cachedTeeEndpoint = { url: endpoint, resolvedAt: Date.now() };
    return endpoint;
  } catch {
    return null;
  }
}

function getPrivateKey(): `0x${string}` | null {
  const key = process.env.OG_PRIVATE_KEY;
  if (!key) return null;
  return key as `0x${string}`;
}

async function tryX402Fetch(options: OGChatOptions): Promise<OGChatResult | null> {
  try {
    const key = getPrivateKey();
    if (!key) return null;

    // Resolve TEE endpoint from on-chain registry
    const teeEndpoint = await resolveTeeEndpoint();
    if (!teeEndpoint) return null;

    const llmUrl = `${teeEndpoint}/v1/chat/completions`;

    const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
    const { registerExactEvmScheme } = await import("@x402/evm/exact/client");
    const { UptoEvmScheme } = await import("@x402/evm/upto/client");

    const account = privateKeyToAccount(key);
    const client = new x402Client();
    registerExactEvmScheme(client, {
      signer: account,
      networks: ["eip155:84532"],
    });
    // Register upto scheme (x402 v2) — required by TEE payment flow
    const uptoScheme = new UptoEvmScheme(account);
    client.register("eip155:84532", uptoScheme);

    const x402Fetch = wrapFetchWithPayment(fetch, client);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${X402_PLACEHOLDER_API_KEY}`,
    };
    if (options.settlement_type) {
      headers["X-SETTLEMENT-TYPE"] = options.settlement_type;
    }

    const response = await x402Fetch(llmUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: options.model ?? TEE_LLM.CLAUDE_OPUS_4_6,
        messages: options.messages,
        temperature: options.temperature ?? 0.0,
        max_tokens: options.max_tokens ?? 1000,
      }),
    });

    if (!response.ok) {
      // TEE might be stale — clear cache for next attempt
      cachedTeeEndpoint = null;
      return null;
    }

    const data = await response.json();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v: string, k: string) => { responseHeaders[k] = v; });

    // Extract settlement hash from X-PAYMENT-RESPONSE or x-processing-hash header
    const paymentResponse = responseHeaders["x-payment-response"];
    let settlementHash: string | null = null;
    if (paymentResponse) {
      try {
        const decoded = JSON.parse(atob(paymentResponse));
        settlementHash = decoded.txHash || paymentResponse;
      } catch {
        settlementHash = paymentResponse;
      }
    }
    if (!settlementHash) {
      settlementHash = responseHeaders["x-processing-hash"] || responseHeaders["x-settlement-hash"] || null;
    }
    const explorerUrl = settlementHash ? `${OG_EXPLORER_URL}/${settlementHash}` : null;

    return { ...data, _raw: data, _headers: responseHeaders, _mock: false, _settlementHash: settlementHash, _explorerUrl: explorerUrl, _teeEndpoint: teeEndpoint };
  } catch {
    // Clear cache on failure so next call picks a fresh TEE
    cachedTeeEndpoint = null;
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
    _teeEndpoint: null,
  };
}

// Export for smoke test / diagnostics
export { resolveTeeEndpoint };

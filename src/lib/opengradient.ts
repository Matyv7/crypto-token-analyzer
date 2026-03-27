import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const OG_LLM_URL = "https://llm.opengradient.ai/v1/chat/completions";

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
  // The full raw response for hash discovery
  _raw: Record<string, unknown>;
  // Response headers for payment proof
  _headers: Record<string, string>;
};

function getPrivateKey(): `0x${string}` {
  const key = process.env.OG_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "OG_PRIVATE_KEY environment variable is not set.\n" +
      "Get testnet tokens at https://faucet.opengradient.ai/\n" +
      "Then add OG_PRIVATE_KEY=0x... to .env.local"
    );
  }
  return key as `0x${string}`;
}

function createX402Fetch() {
  const account = privateKeyToAccount(getPrivateKey());
  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: account,
    networks: ["eip155:84532"],
  });

  return wrapFetchWithPayment(fetch, client);
}

export async function ogChat(options: OGChatOptions): Promise<OGChatResult> {
  const x402Fetch = createX402Fetch();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Settlement type header
  if (options.settlement_type) {
    headers["X-SETTLEMENT-TYPE"] = options.settlement_type;
  }

  const response = await x402Fetch(OG_LLM_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: options.model ?? "anthropic/claude-opus-4-6",
      messages: options.messages,
      temperature: options.temperature ?? 0.0,
      max_tokens: options.max_tokens ?? 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenGradient API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Capture response headers for payment proof
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value: string, key: string) => {
    responseHeaders[key] = value;
  });

  return {
    ...data,
    _raw: data,
    _headers: responseHeaders,
  };
}

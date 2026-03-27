import { NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";

export const maxDuration = 60;

export async function GET() {
  const steps: Record<string, unknown> = {};

  try {
    // Step 1: Check env var
    const key = process.env.OG_PRIVATE_KEY;
    steps["1_env_check"] = {
      has_key: !!key,
      key_prefix: key ? key.substring(0, 6) + "..." : "MISSING",
    };
    if (!key) {
      return NextResponse.json({ success: false, steps, error: "OG_PRIVATE_KEY not set" }, { status: 500 });
    }

    // Step 2: Derive wallet address
    let address: string;
    try {
      const account = privateKeyToAccount(key as `0x${string}`);
      address = account.address;
      steps["2_wallet"] = { address };
    } catch (e) {
      steps["2_wallet"] = { error: String(e) };
      return NextResponse.json({ success: false, steps, error: "Invalid private key format" }, { status: 500 });
    }

    // Step 3: Plain fetch to OpenGradient (no x402) — test connectivity
    try {
      const pingResp = await fetch("https://llm.opengradient.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "anthropic/claude-opus-4-6",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
      });
      const pingStatus = pingResp.status;
      const pingBody = await pingResp.text();
      steps["3_plain_fetch"] = {
        status: pingStatus,
        body_preview: pingBody.substring(0, 500),
      };
    } catch (e) {
      steps["3_plain_fetch"] = { error: String(e) };
      return NextResponse.json({ success: false, steps, error: "Cannot reach OpenGradient API" }, { status: 500 });
    }

    // Step 4: x402 fetch
    try {
      const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
      const { registerExactEvmScheme } = await import("@x402/evm/exact/client");

      const account = privateKeyToAccount(key as `0x${string}`);
      const client = new x402Client();
      registerExactEvmScheme(client, {
        signer: account,
        networks: ["eip155:84532"],
      });
      const x402Fetch = wrapFetchWithPayment(fetch, client);

      steps["4_x402_init"] = "ok";

      const response = await x402Fetch("https://llm.opengradient.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SETTLEMENT-TYPE": "individual",
        },
        body: JSON.stringify({
          model: "anthropic/claude-opus-4-6",
          messages: [
            { role: "system", content: "Reply concisely." },
            { role: "user", content: 'Respond with exactly: {"status":"ok"}' },
          ],
          temperature: 0.0,
          max_tokens: 50,
        }),
      });

      const respHeaders: Record<string, string> = {};
      response.headers.forEach((v: string, k: string) => { respHeaders[k] = v; });

      const data = await response.json();
      steps["5_x402_response"] = {
        status: response.status,
        headers: respHeaders,
        body: data,
      };

      return NextResponse.json({
        success: true,
        wallet_address: address,
        llm_response: data?.choices?.[0]?.message?.content,
        full_response: data,
        response_headers: respHeaders,
        steps,
      });
    } catch (e) {
      const err = e instanceof Error ? { message: e.message, stack: e.stack?.split("\n").slice(0, 5) } : String(e);
      steps["4_x402_error"] = err;
      return NextResponse.json({ success: false, steps, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
    }
  } catch (e) {
    steps["unexpected"] = String(e);
    return NextResponse.json({ success: false, steps, error: String(e) }, { status: 500 });
  }
}

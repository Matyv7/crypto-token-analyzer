import { NextResponse } from "next/server";
import { ogChat } from "@/lib/opengradient";

export async function GET() {
  console.log("=".repeat(60));
  console.log("OpenGradient x402 Smoke Test — Phase 1");
  console.log("=".repeat(60));

  try {
    console.log("\n[1] Making x402 chat call...");
    console.log("    model    = anthropic/claude-opus-4-6");
    console.log("    mode     = individual (INDIVIDUAL_FULL)");

    const result = await ogChat({
      model: "anthropic/claude-opus-4-6",
      messages: [
        { role: "system", content: "You are a helpful assistant. Reply concisely." },
        { role: "user", content: 'Respond with exactly this JSON and nothing else: {"status": "ok", "phase": 1}' },
      ],
      temperature: 0.0,
      max_tokens: 50,
      settlement_type: "individual",
    });

    console.log("\n[2] Result received. Full response dump:");
    console.log("-".repeat(40));
    console.log(JSON.stringify(result._raw, null, 2));

    console.log("\n[3] Response headers (payment proof):");
    console.log("-".repeat(40));
    for (const [key, value] of Object.entries(result._headers)) {
      console.log(`  ${key}: ${value}`);
      if (key.toLowerCase().includes("payment") || key.toLowerCase().includes("x-")) {
        console.log(`  ^ IMPORTANT — potential verification proof header`);
      }
    }

    console.log("\n[4] LLM response content:");
    const content = result.choices?.[0]?.message?.content;
    console.log(`  content = ${JSON.stringify(content)}`);

    console.log("\n[5] SUMMARY:");
    console.log("  Check the response headers above for X-PAYMENT-RESPONSE");
    console.log("  This contains the x402 payment receipt/proof");
    console.log("  Visit explorer.opengradient.ai to verify settlement");
    console.log("\nSmoke test complete.");

    return NextResponse.json({
      success: true,
      llm_response: content,
      raw_response: result._raw,
      headers: result._headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nERROR: ${message}`);

    if (message.includes("402") || message.toLowerCase().includes("payment")) {
      console.error("  Your testnet wallet needs OPG tokens.");
      console.error("  Visit: https://faucet.opengradient.ai/");
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

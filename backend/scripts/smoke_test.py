"""
Phase 1 Smoke Test — OpenGradient SDK end-to-end validation.

Resolves the CRITICAL UNKNOWN: which field on the result object holds the
OpenGradient chain settlement hash (for explorer.opengradient.ai)?

Run from backend/ directory:
    OG_PRIVATE_KEY=<your_key> python -m scripts.smoke_test

Expected output:
  - Full result object attribute dump
  - Identification of payment_hash (Base Sepolia) vs settlement hash (OG chain)
  - Verification: explorer.opengradient.ai link for the settlement hash
"""

import asyncio
import os
import sys

import opengradient as og


def _safe_key() -> str:
    key = os.environ.get("OG_PRIVATE_KEY", "")
    if not key:
        print("ERROR: OG_PRIVATE_KEY environment variable is not set.")
        print("  Get testnet tokens at https://faucet.opengradient.ai/")
        print("  Then: export OG_PRIVATE_KEY=<your_private_key>")
        sys.exit(1)
    return key


async def run_smoke_test() -> None:
    print("=" * 60)
    print("OpenGradient SDK Smoke Test — Phase 1")
    print("=" * 60)

    # Initialize client (same pattern as main.py lifespan)
    llm = og.LLM(private_key=_safe_key())

    print("\n[1] Running ensure_opg_approval(100.0)...")
    llm.ensure_opg_approval(opg_amount=100.0)
    print("    OPG approval confirmed.")

    # Minimal chat call — just enough to trigger a real INDIVIDUAL_FULL settlement
    messages = [
        {"role": "system", "content": "You are a helpful assistant. Reply concisely."},
        {
            "role": "user",
            "content": (
                "Respond with exactly this JSON and nothing else: "
                '{"status": "ok", "phase": 1}'
            ),
        },
    ]

    print("\n[2] Calling llm.chat() with:")
    print(f"    model    = og.TEE_LLM.CLAUDE_OPUS_4_6")
    print(f"    mode     = og.x402SettlementMode.INDIVIDUAL_FULL")
    print()

    try:
        result = await llm.chat(
            model=og.TEE_LLM.CLAUDE_OPUS_4_6,
            messages=messages,
            temperature=0.0,
            max_tokens=50,
            settlement_mode=og.x402SettlementMode.INDIVIDUAL_FULL,
        )
    except Exception as exc:
        # Catch HTTP 402 explicitly for actionable error message (Pitfall 15)
        if "402" in str(exc) or "payment" in str(exc).lower():
            print(f"ERROR: Payment failed (HTTP 402) — {exc}")
            print("  Your testnet wallet needs OPG tokens.")
            print("  Visit: https://faucet.opengradient.ai/")
        else:
            print(f"ERROR: Unexpected exception — {type(exc).__name__}: {exc}")
        sys.exit(1)

    print("[3] Result received. Full attribute dump:")
    print("-" * 40)

    # Introspect ALL attributes — this is the key discovery step
    result_attrs = {}
    for attr in dir(result):
        if attr.startswith("_"):
            continue
        try:
            val = getattr(result, attr)
            if callable(val):
                continue
            result_attrs[attr] = val
            print(f"  result.{attr} = {val!r}")
        except Exception:
            pass

    # Also try __dict__ if available
    if hasattr(result, "__dict__"):
        print("\n  result.__dict__:")
        for k, v in result.__dict__.items():
            print(f"    {k!r}: {v!r}")

    print("-" * 40)

    # Extract and classify hashes
    print("\n[4] Hash classification:")

    payment_hash = getattr(result, "payment_hash", None)
    transaction_hash = getattr(result, "transaction_hash", None)

    # Check for any other hash-like fields
    hash_fields = {
        k: v
        for k, v in result_attrs.items()
        if isinstance(v, str) and (v.startswith("0x") or len(v) == 64)
    }

    if payment_hash:
        print(f"  payment_hash    = {payment_hash}")
        print(f"  -> Base Sepolia explorer: https://sepolia.basescan.org/tx/{payment_hash}")
        print(f"  -> NOT the verification proof (this is the x402 payment tx)")

    if transaction_hash:
        print(f"  transaction_hash = {transaction_hash}")
        print(f"  -> OG chain explorer: https://explorer.opengradient.ai/tx/{transaction_hash}")
        print(f"  -> CANDIDATE for verification proof — verify this URL in browser")

    for field, val in hash_fields.items():
        if field not in ("payment_hash", "transaction_hash"):
            print(f"  {field} = {val}")
            print(f"  -> OTHER hash field — inspect manually")

    # LLM response content
    print("\n[5] LLM response content:")
    chat_output = getattr(result, "chat_output", None)
    if chat_output:
        content = chat_output.get("content") if isinstance(chat_output, dict) else str(chat_output)
        print(f"  chat_output[content] = {content!r}")
    else:
        print(f"  chat_output = {chat_output!r}")

    print("\n[6] SUMMARY — action required:")
    print("  Visit explorer.opengradient.ai and verify which hash above")
    print("  shows the inference input/output record (not just a payment).")
    print("  Record the correct field name in STATE.md Critical Facts.")
    print()
    print("  Expected: transaction_hash -> explorer.opengradient.ai shows inference data")
    print("  Expected: payment_hash     -> sepolia.basescan.org shows OPG token transfer")
    print()
    print("Smoke test complete.")


if __name__ == "__main__":
    asyncio.run(run_smoke_test())

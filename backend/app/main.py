from contextlib import asynccontextmanager
from typing import AsyncGenerator

import opengradient as og
from fastapi import FastAPI

from .settings import get_settings

# Module-level holder for the LLM client — initialized once at startup
_llm_client: og.LLM | None = None


def get_llm() -> og.LLM:
    """Return the module-level LLM client. Raises if not initialized."""
    if _llm_client is None:
        raise RuntimeError("LLM client not initialized — startup failed")
    return _llm_client


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize OpenGradient SDK once at startup, clean up on shutdown."""
    global _llm_client

    settings = get_settings()
    # CRITICAL: private key loaded from settings only — never log it
    _llm_client = og.LLM(private_key=settings.og_private_key)

    # Approve OPG allowance once at startup (not per-request — see PITFALLS.md Pitfall 6)
    # 100 OPG covers ~100 inference calls without re-approval
    _llm_client.ensure_opg_approval(opg_amount=100.0)

    print("OpenGradient LLM client initialized. OPG approval confirmed.")
    yield

    # Cleanup (nothing to do for og.LLM currently)
    _llm_client = None
    print("OpenGradient LLM client shut down.")


app = FastAPI(
    title="Crypto Token Analyzer",
    description="TEE-verified token risk analysis via OpenGradient",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health_check() -> dict:
    """Verify the server is running and the LLM client is initialized."""
    llm = get_llm()
    return {"status": "ok", "llm_ready": llm is not None}

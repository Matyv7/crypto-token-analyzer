import { NextResponse } from "next/server";
import { fetchTokenInfo, fetchContractData, fetchHolderData, fetchLiquidityData } from "@/lib/evm-fetcher";
import { buildAnalysis } from "@/lib/analyzer";
import { detectChain } from "@/lib/chains";
import type { SupportedChain } from "@/lib/chains";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, chain: requestedChain } = body as { address?: string; chain?: string };

    if (!address) {
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    // Validate address format
    const detectedType = detectChain(address);
    if (detectedType === "solana") {
      return NextResponse.json({ error: "Solana tokens not yet supported — coming soon" }, { status: 400 });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid address format. Expected 0x followed by 40 hex characters." }, { status: 400 });
    }

    // Determine chain
    const chain = (requestedChain as SupportedChain) || "ethereum";
    const validChains = ["ethereum", "base", "bsc"];
    if (!validChains.includes(chain)) {
      return NextResponse.json({ error: `Unsupported chain: ${chain}. Use: ${validChains.join(", ")}` }, { status: 400 });
    }

    // Fetch all on-chain data in parallel
    const [tokenInfo, contractData, holderData, liquidityData] = await Promise.all([
      fetchTokenInfo(address, chain),
      fetchContractData(address, chain),
      fetchHolderData(address, chain),
      fetchLiquidityData(address, chain),
    ]);

    // Build analysis (mock scoring for now — real LLM analysis when OpenGradient comes online)
    const result = buildAnalysis(tokenInfo, holderData, liquidityData, contractData, true);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

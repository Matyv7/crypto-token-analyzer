import type { AnalysisResult, RiskGrade, RiskFactor, TokenInfo, HolderData, LiquidityData, ContractData } from "./types";

function gradeFromScore(score: number): RiskGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function averageGrade(factors: RiskFactor[]): RiskGrade {
  const gradeValues: Record<RiskGrade, number> = { A: 95, B: 80, C: 65, D: 50, F: 25 };
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = factors.reduce((sum, f) => sum + gradeValues[f.score] * f.weight, 0);
  return gradeFromScore(weightedSum / totalWeight);
}

function analyzeContract(contract: ContractData): RiskFactor {
  let score = 100;
  const issues: string[] = [];

  if (!contract.isVerified) { score -= 30; issues.push("no contract bytecode found"); }
  if (contract.hasMintFunction) { score -= 20; issues.push("mint function present"); }
  if (contract.hasBlacklist) { score -= 15; issues.push("blacklist capability"); }
  if (!contract.ownershipRenounced) { score -= 10; issues.push("ownership not renounced"); }
  if (contract.hasProxy) { score -= 10; issues.push("upgradeable proxy"); }

  return {
    name: "Contract Security",
    score: gradeFromScore(Math.max(0, score)),
    weight: 3,
    description: issues.length === 0 ? "Contract passes all on-chain security checks" : `Flags: ${issues.join(", ")}`,
  };
}

function analyzeHolders(holders: HolderData): RiskFactor {
  const topPercent = holders.topHolders.slice(0, 5).reduce((sum, h) => sum + h.percentage, 0);
  let score = 100;

  if (topPercent > 80) score = 20;
  else if (topPercent > 60) score = 40;
  else if (topPercent > 40) score = 60;
  else if (topPercent > 20) score = 80;

  return {
    name: "Holder Distribution",
    score: gradeFromScore(score),
    weight: 2,
    description: `Top 5 holders control ${topPercent.toFixed(1)}% of supply. ${holders.concentrationRisk} concentration risk.`,
  };
}

function analyzeLiquidity(liquidity: LiquidityData): RiskFactor {
  const depthScores = { deep: 95, moderate: 70, shallow: 40, none: 10 };
  return {
    name: "Liquidity Depth",
    score: gradeFromScore(depthScores[liquidity.depth]),
    weight: 2,
    description: liquidity.hasLiquidity
      ? `Liquidity pool found with ${liquidity.depth} depth`
      : "No liquidity pool detected — token may be untradeable",
  };
}

const OG_EXPLORER_BASE = "https://explorer.opengradient.ai/tx";

export function buildAnalysis(
  token: TokenInfo,
  holders: HolderData,
  liquidity: LiquidityData,
  contract: ContractData,
  isMock: boolean,
  settlementHash?: string | null,
): AnalysisResult {
  const factors: RiskFactor[] = [
    analyzeContract(contract),
    analyzeHolders(holders),
    analyzeLiquidity(liquidity),
  ];

  const grade = averageGrade(factors);

  const gradeDescriptions: Record<RiskGrade, string> = {
    A: "Low risk — strong fundamentals across all factors",
    B: "Moderate risk — mostly solid with minor concerns",
    C: "Elevated risk — several yellow flags detected",
    D: "High risk — significant concerns in multiple areas",
    F: "Critical risk — major red flags detected, exercise extreme caution",
  };

  return {
    token,
    grade,
    factors,
    summary: `${token.symbol} receives a ${grade} grade. ${gradeDescriptions[grade]}.`,
    holders,
    liquidity,
    contract,
    verification: {
      provider: "opengradient-tee",
      settlementHash: settlementHash ?? null,
      explorerUrl: settlementHash ? `${OG_EXPLORER_BASE}/${settlementHash}` : null,
      isMock,
    },
    analyzedAt: new Date().toISOString(),
  };
}

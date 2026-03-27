export type RiskGrade = "A" | "B" | "C" | "D" | "F";

export type RiskFactor = {
  name: string;
  score: RiskGrade;
  weight: number;
  description: string;
};

export type TokenInfo = {
  address: string;
  chain: "ethereum" | "base" | "bsc" | "solana";
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
};

export type HolderData = {
  topHolders: Array<{
    address: string;
    percentage: number;
  }>;
  totalHolders?: number;
  concentrationRisk: "low" | "medium" | "high";
};

export type LiquidityData = {
  hasLiquidity: boolean;
  poolAddress?: string;
  totalValueUsd?: number;
  depth: "deep" | "moderate" | "shallow" | "none";
};

export type ContractData = {
  isVerified: boolean;
  hasProxy: boolean;
  hasMintFunction: boolean;
  hasBlacklist: boolean;
  ownershipRenounced: boolean;
};

export type AnalysisResult = {
  token: TokenInfo;
  grade: RiskGrade;
  factors: RiskFactor[];
  summary: string;
  holders: HolderData;
  liquidity: LiquidityData;
  contract: ContractData;
  verification: {
    provider: "opengradient-tee";
    settlementHash: string | null;
    explorerUrl: string | null;
    isMock: boolean;
  };
  analyzedAt: string;
};

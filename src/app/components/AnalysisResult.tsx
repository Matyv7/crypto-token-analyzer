"use client";

import type { AnalysisResult as AnalysisResultType, RiskGrade } from "@/lib/types";

const gradeColors: Record<RiskGrade, string> = {
  A: "var(--grade-a)",
  B: "var(--grade-b)",
  C: "var(--grade-c)",
  D: "var(--grade-d)",
  F: "var(--grade-f)",
};

const gradeLabels: Record<RiskGrade, string> = {
  A: "Low Risk",
  B: "Moderate Risk",
  C: "Elevated Risk",
  D: "High Risk",
  F: "Critical Risk",
};

function GradeBadge({ grade }: { grade: RiskGrade }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontSize: "72px",
        fontWeight: 800,
        color: gradeColors[grade],
        lineHeight: 1,
      }}>
        {grade}
      </div>
      <div style={{
        fontSize: "14px",
        color: gradeColors[grade],
        fontWeight: 600,
        marginTop: "4px",
      }}>
        {gradeLabels[grade]}
      </div>
    </div>
  );
}

function FactorCard({ factor }: { factor: AnalysisResultType["factors"][0] }) {
  return (
    <div style={{
      backgroundColor: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: "8px",
      padding: "16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontWeight: 600, fontSize: "14px" }}>{factor.name}</span>
        <span style={{
          color: gradeColors[factor.score],
          fontWeight: 700,
          fontSize: "18px",
        }}>
          {factor.score}
        </span>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
        {factor.description}
      </p>
    </div>
  );
}

type Props = {
  result: AnalysisResultType;
};

export default function AnalysisResult({ result }: Props) {
  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "16px",
        textAlign: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>{result.token.symbol}</h2>
          <span style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "2px 8px",
            fontSize: "12px",
            color: "var(--text-secondary)",
          }}>
            {result.token.chain.toUpperCase()}
          </span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: "0 0 16px 0" }}>
          {result.token.name}
        </p>
        <GradeBadge grade={result.grade} />
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "16px" }}>
          {result.summary}
        </p>
      </div>

      {/* Risk Factors */}
      <div style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "16px",
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>Risk Factors</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {result.factors.map((factor) => (
            <FactorCard key={factor.name} factor={factor} />
          ))}
        </div>
      </div>

      {/* Token Details */}
      <div style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "16px",
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>Token Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "14px" }}>
          <div>
            <div style={{ color: "var(--text-secondary)", marginBottom: "2px" }}>Address</div>
            <div style={{ fontFamily: "monospace", fontSize: "12px", wordBreak: "break-all" }}>{result.token.address}</div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)", marginBottom: "2px" }}>Total Supply</div>
            <div>{Number(result.token.totalSupply).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)", marginBottom: "2px" }}>Contract Verified</div>
            <div>{result.contract.isVerified ? "Yes" : "No"}</div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)", marginBottom: "2px" }}>Ownership</div>
            <div>{result.contract.ownershipRenounced ? "Renounced" : "Active"}</div>
          </div>
        </div>
      </div>

      {/* Verification */}
      <div style={{
        backgroundColor: "var(--bg-card)",
        border: result.verification.isMock ? "1px solid var(--border)" : "1px solid var(--grade-a)",
        borderRadius: "12px",
        padding: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>{result.verification.isMock ? "\u26A0" : "\u2713"}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: "14px" }}>
              {result.verification.isMock ? "Mock Analysis" : "Verified by OpenGradient TEE"}
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
              {result.verification.isMock
                ? "OpenGradient API offline — using local scoring. TEE verification unavailable."
                : result.verification.explorerUrl
                  ? `Settlement: ${result.verification.settlementHash}`
                  : "Verification pending"
              }
            </div>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "12px", marginTop: "12px" }}>
        Analyzed at {new Date(result.analyzedAt).toLocaleString()}
      </p>
    </div>
  );
}

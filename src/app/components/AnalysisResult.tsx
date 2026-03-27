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
        fontSize: "80px",
        fontWeight: 300,
        color: gradeColors[grade],
        lineHeight: 1,
        letterSpacing: "-0.025em",
      }}>
        {grade}
      </div>
      <div style={{
        fontSize: "13px",
        color: gradeColors[grade],
        fontFamily: '"Geist Mono", monospace',
        fontWeight: 500,
        marginTop: "8px",
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
      }}>
        {gradeLabels[grade]}
      </div>
    </div>
  );
}

function FactorCard({ factor }: { factor: AnalysisResultType["factors"][0] }) {
  return (
    <div style={{
      backgroundColor: "#141e32",
      border: "1px solid rgba(36, 188, 227, 0.15)",
      borderRadius: "12px",
      padding: "16px 20px",
      transition: "box-shadow 0.3s ease, border-color 0.3s ease",
      cursor: "default",
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 0 40px rgba(36, 188, 227, 0.15)";
        e.currentTarget.style.borderColor = "rgba(36, 188, 227, 0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "rgba(36, 188, 227, 0.15)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{
          fontWeight: 300,
          fontSize: "15px",
          color: "#e9f8fc",
          letterSpacing: "-0.01em",
        }}>
          {factor.name}
        </span>
        <span style={{
          color: gradeColors[factor.score],
          fontWeight: 300,
          fontSize: "24px",
          letterSpacing: "-0.025em",
        }}>
          {factor.score}
        </span>
      </div>
      <p style={{
        color: "#bdebf7",
        fontSize: "13px",
        margin: 0,
        lineHeight: 1.5,
        fontWeight: 300,
      }}>
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
    <div style={{
      maxWidth: "640px",
      margin: "0 auto",
      animation: "ogFadeUp 0.5s ease-out",
    }}>
      {/* Header Card */}
      <div style={{
        backgroundColor: "#141e32",
        border: "1px solid rgba(36, 188, 227, 0.15)",
        borderRadius: "16px",
        padding: "32px",
        marginBottom: "16px",
        textAlign: "center",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          marginBottom: "12px",
        }}>
          <h2 style={{
            fontSize: "28px",
            fontWeight: 300,
            margin: 0,
            color: "#e9f8fc",
            letterSpacing: "-0.025em",
          }}>
            {result.token.symbol}
          </h2>
          <span style={{
            backgroundColor: "rgba(36, 188, 227, 0.08)",
            border: "1px solid rgba(36, 188, 227, 0.2)",
            borderRadius: "9999px",
            padding: "3px 12px",
            fontSize: "11px",
            fontFamily: '"Geist Mono", monospace',
            color: "#24bce3",
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
          }}>
            {result.token.chain}
          </span>
        </div>
        <p style={{
          color: "#bdebf7",
          fontSize: "14px",
          margin: "0 0 24px 0",
          fontWeight: 300,
        }}>
          {result.token.name}
        </p>
        <GradeBadge grade={result.grade} />
        <p style={{
          color: "#bdebf7",
          fontSize: "14px",
          marginTop: "24px",
          lineHeight: 1.6,
          fontWeight: 300,
        }}>
          {result.summary}
        </p>
      </div>

      {/* Risk Factors */}
      <div style={{
        backgroundColor: "#141e32",
        border: "1px solid rgba(36, 188, 227, 0.15)",
        borderRadius: "16px",
        padding: "28px",
        marginBottom: "16px",
      }}>
        <h3 style={{
          fontSize: "13px",
          fontFamily: '"Geist Mono", monospace',
          fontWeight: 500,
          marginBottom: "16px",
          color: "#167188",
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
        }}>
          Risk Factors
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {result.factors.map((factor) => (
            <FactorCard key={factor.name} factor={factor} />
          ))}
        </div>
      </div>

      {/* Token Details */}
      <div style={{
        backgroundColor: "#141e32",
        border: "1px solid rgba(36, 188, 227, 0.15)",
        borderRadius: "16px",
        padding: "28px",
        marginBottom: "16px",
      }}>
        <h3 style={{
          fontSize: "13px",
          fontFamily: '"Geist Mono", monospace',
          fontWeight: 500,
          marginBottom: "16px",
          color: "#167188",
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
        }}>
          Token Details
        </h3>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
        }}>
          <div>
            <div style={{
              color: "#167188",
              fontSize: "11px",
              fontFamily: '"Geist Mono", monospace',
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              marginBottom: "4px",
            }}>
              Address
            </div>
            <div style={{
              fontFamily: '"Geist Mono", monospace',
              fontSize: "12px",
              color: "#bdebf7",
              wordBreak: "break-all",
            }}>
              {result.token.address}
            </div>
          </div>
          <div>
            <div style={{
              color: "#167188",
              fontSize: "11px",
              fontFamily: '"Geist Mono", monospace',
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              marginBottom: "4px",
            }}>
              Total Supply
            </div>
            <div style={{
              fontSize: "16px",
              fontWeight: 300,
              color: "#e9f8fc",
            }}>
              {Number(result.token.totalSupply).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{
              color: "#167188",
              fontSize: "11px",
              fontFamily: '"Geist Mono", monospace',
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              marginBottom: "4px",
            }}>
              Contract Verified
            </div>
            <div style={{
              fontSize: "14px",
              color: result.contract.isVerified ? "#05df72" : "#fb2c36",
              fontWeight: 300,
            }}>
              {result.contract.isVerified ? "Yes" : "No"}
            </div>
          </div>
          <div>
            <div style={{
              color: "#167188",
              fontSize: "11px",
              fontFamily: '"Geist Mono", monospace',
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              marginBottom: "4px",
            }}>
              Ownership
            </div>
            <div style={{
              fontSize: "14px",
              color: result.contract.ownershipRenounced ? "#05df72" : "#edb200",
              fontWeight: 300,
            }}>
              {result.contract.ownershipRenounced ? "Renounced" : "Active"}
            </div>
          </div>
        </div>
      </div>

      {/* Verification */}
      <div style={{
        backgroundColor: "#141e32",
        border: result.verification.isMock
          ? "1px solid rgba(237, 178, 0, 0.3)"
          : "1px solid rgba(5, 223, 114, 0.3)",
        borderRadius: "16px",
        padding: "20px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: result.verification.isMock
              ? "rgba(237, 178, 0, 0.1)"
              : "rgba(5, 223, 114, 0.1)",
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: "16px",
              color: result.verification.isMock ? "#edb200" : "#05df72",
            }}>
              {result.verification.isMock ? "\u26A0" : "\u2713"}
            </span>
          </div>
          <div>
            <div style={{
              fontWeight: 300,
              fontSize: "15px",
              color: "#e9f8fc",
              marginBottom: "4px",
            }}>
              {result.verification.isMock ? "Mock Analysis" : "Verified by OpenGradient TEE"}
            </div>
            <div style={{
              color: "#167188",
              fontSize: "12px",
              fontFamily: '"Geist Mono", monospace',
              letterSpacing: "0.02em",
            }}>
              {result.verification.isMock
                ? "OpenGradient API offline \u2014 using local scoring. TEE verification unavailable."
                : result.verification.explorerUrl
                  ? `Settlement: ${result.verification.settlementHash}`
                  : "Verification pending"
              }
            </div>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <p style={{
        textAlign: "center",
        color: "#167188",
        fontSize: "11px",
        fontFamily: '"Geist Mono", monospace',
        marginTop: "16px",
        letterSpacing: "0.04em",
      }}>
        Analyzed at {new Date(result.analyzedAt).toLocaleString()}
      </p>
    </div>
  );
}

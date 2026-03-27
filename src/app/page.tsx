"use client";

import { useState } from "react";
import TokenInput from "./components/TokenInput";
import AnalysisResult from "./components/AnalysisResult";
import type { AnalysisResult as AnalysisResultType } from "@/lib/types";

export default function Home() {
  const [result, setResult] = useState<AnalysisResultType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async (address: string, chain: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Analysis failed");
        return;
      }

      setResult(data);
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", padding: "40px 16px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: 800, marginBottom: "8px" }}>
          Crypto Token Analyzer
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "500px", margin: "0 auto" }}>
          AI-powered token risk analysis with on-chain verification proof
        </p>
      </div>

      {/* Input */}
      <TokenInput onAnalyze={handleAnalyze} isLoading={isLoading} />

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: "center", marginTop: "32px", color: "var(--text-secondary)" }}>
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>Analyzing token...</div>
          <div style={{ fontSize: "14px" }}>Fetching on-chain data and running analysis</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          maxWidth: "640px",
          margin: "24px auto",
          padding: "16px",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          border: "1px solid var(--grade-f)",
          borderRadius: "8px",
          color: "var(--grade-f)",
          textAlign: "center",
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: "32px" }}>
          <AnalysisResult result={result} />
        </div>
      )}

      {/* Footer */}
      <footer style={{
        textAlign: "center",
        marginTop: "60px",
        padding: "20px",
        color: "var(--text-secondary)",
        fontSize: "12px",
      }}>
        Powered by OpenGradient TEE-verified inference
      </footer>
    </main>
  );
}

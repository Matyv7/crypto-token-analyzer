"use client";

import { useState, useRef } from "react";
import TokenInput from "./components/TokenInput";
import AnalysisResult from "./components/AnalysisResult";
import type { AnalysisResult as AnalysisResultType } from "@/lib/types";

export default function Home() {
  const [result, setResult] = useState<AnalysisResultType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const analyzeRef = useRef<HTMLDivElement>(null);

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

  const scrollToAnalyze = () => {
    analyzeRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main style={{ minHeight: "100vh" }}>
      {/* Navbar */}
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        backgroundColor: "rgba(10, 15, 25, 0.8)",
        borderBottom: "1px solid rgba(36, 188, 227, 0.1)",
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 24px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div data-og-logo="wordmark" style={{ height: "30px" }}></div>
          <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
            <a href="#analyze" onClick={(e) => { e.preventDefault(); scrollToAnalyze(); }} style={{
              color: "#bdebf7",
              fontSize: "14px",
              textDecoration: "none",
              fontFamily: '"Geist Mono", monospace',
              letterSpacing: "0.05em",
              textTransform: "uppercase" as const,
            }}>
              Analyze
            </a>
            <a href="https://opengradient.ai" target="_blank" rel="noopener noreferrer" style={{
              color: "#bdebf7",
              fontSize: "14px",
              textDecoration: "none",
              fontFamily: '"Geist Mono", monospace',
              letterSpacing: "0.05em",
              textTransform: "uppercase" as const,
            }}>
              Docs
            </a>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#05df72",
              fontFamily: '"Geist Mono", monospace',
              fontSize: "12px",
              letterSpacing: "0.05em",
            }}>
              <span style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#05df72",
                display: "inline-block",
                animation: "pulse 2s infinite",
              }} />
              TEE LIVE
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        paddingTop: "160px",
        paddingBottom: "80px",
        textAlign: "center",
        background: "linear-gradient(135deg, #0a0f19 0%, #141e32 50%, #0e4b5b 100%)",
        position: "relative",
      }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 24px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 16px",
            borderRadius: "9999px",
            border: "1px solid rgba(36, 188, 227, 0.2)",
            backgroundColor: "rgba(36, 188, 227, 0.06)",
            marginBottom: "32px",
            fontFamily: '"Geist Mono", monospace',
            fontSize: "12px",
            color: "#24bce3",
            letterSpacing: "0.05em",
            textTransform: "uppercase" as const,
          }}>
            <span style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#05df72",
              display: "inline-block",
              animation: "pulse 2s infinite",
            }} />
            Powered by TEE-Verified Inference
          </div>

          <h1 style={{
            fontSize: "56px",
            fontWeight: 300,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            marginBottom: "24px",
            color: "#e9f8fc",
          }}>
            Crypto Token
            <br />
            <span style={{ color: "#24bce3" }}>Risk Analyzer</span>
          </h1>

          <p style={{
            fontSize: "18px",
            color: "#bdebf7",
            maxWidth: "560px",
            margin: "0 auto 40px",
            lineHeight: 1.6,
            fontWeight: 300,
          }}>
            AI-powered token analysis with cryptographic proof. Every risk score
            is verified on-chain through OpenGradient&apos;s Trusted Execution Environment.
          </p>

          <button
            onClick={scrollToAnalyze}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px 36px",
              borderRadius: "9999px",
              border: "none",
              backgroundColor: "#24bce3",
              color: "#0a0f19",
              fontFamily: '"Geist Mono", monospace',
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Analyze Token
            <span style={{ fontSize: "16px" }}>&darr;</span>
          </button>
        </div>
      </section>

      {/* Analysis Section */}
      <section ref={analyzeRef} id="analyze" style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "80px 24px",
      }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <h2 style={{
            fontSize: "32px",
            fontWeight: 300,
            letterSpacing: "-0.025em",
            marginBottom: "12px",
            color: "#e9f8fc",
          }}>
            Token Analysis
          </h2>
          <p style={{ color: "#bdebf7", fontSize: "16px", fontWeight: 300 }}>
            Enter a contract address to receive a TEE-verified risk assessment
          </p>
        </div>

        {/* Input */}
        <TokenInput onAnalyze={handleAnalyze} isLoading={isLoading} />

        {/* Loading */}
        {isLoading && (
          <div style={{
            textAlign: "center",
            marginTop: "48px",
            animation: "ogFadeUp 0.4s ease-out",
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              border: "2px solid rgba(36, 188, 227, 0.15)",
              borderTop: "2px solid #24bce3",
              borderRadius: "50%",
              margin: "0 auto 16px",
              animation: "spin 1s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{
              fontSize: "18px",
              fontWeight: 300,
              color: "#e9f8fc",
              marginBottom: "8px",
            }}>
              Analyzing token...
            </div>
            <div style={{
              fontSize: "13px",
              fontFamily: '"Geist Mono", monospace',
              color: "#167188",
              letterSpacing: "0.03em",
            }}>
              Fetching on-chain data and running TEE-verified inference
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            maxWidth: "640px",
            margin: "32px auto",
            padding: "16px 20px",
            backgroundColor: "rgba(251, 44, 54, 0.08)",
            border: "1px solid rgba(251, 44, 54, 0.3)",
            borderRadius: "16px",
            color: "#fb2c36",
            textAlign: "center",
            fontFamily: '"Geist Mono", monospace',
            fontSize: "14px",
            animation: "ogFadeUp 0.3s ease-out",
          }}>
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{
            marginTop: "48px",
            animation: "ogFadeUp 0.5s ease-out",
          }}>
            <AnalysisResult result={result} />
          </div>
        )}
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid rgba(36, 188, 227, 0.1)",
        padding: "40px 24px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "16px",
          }}>
            <div data-og-logo="wordmark" style={{ height: "20px", opacity: 0.6 }}></div>
          </div>
          <p style={{
            color: "#167188",
            fontSize: "12px",
            fontFamily: '"Geist Mono", monospace',
            letterSpacing: "0.05em",
          }}>
            Powered by OpenGradient TEE-verified inference
          </p>
          <p style={{
            color: "rgba(22, 113, 136, 0.5)",
            fontSize: "11px",
            fontFamily: '"Geist Mono", monospace',
            marginTop: "8px",
          }}>
            All analysis runs inside a Trusted Execution Environment with on-chain settlement
          </p>
        </div>
      </footer>
    </main>
  );
}

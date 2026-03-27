"use client";

import { useState } from "react";

type Props = {
  onAnalyze: (address: string, chain: string) => void;
  isLoading: boolean;
};

export default function TokenInput({ onAnalyze, isLoading }: Props) {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ethereum");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      onAnalyze(address.trim(), chain);
    }
  };

  const disabled = isLoading || !address.trim();

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "640px", margin: "0 auto", width: "100%" }}>
      <div style={{
        backgroundColor: "#141e32",
        border: "1px solid rgba(36, 188, 227, 0.15)",
        borderRadius: "16px",
        padding: "28px",
        transition: "box-shadow 0.3s ease",
      }}>
        {/* Status indicator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "20px",
        }}>
          <span style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "#05df72",
            display: "inline-block",
            animation: "pulse 2s infinite",
          }} />
          <span style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: "11px",
            color: "#167188",
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
          }}>
            Ready for analysis
          </span>
        </div>

        {/* Label */}
        <label style={{
          color: "#bdebf7",
          fontSize: "13px",
          fontFamily: '"Geist Mono", monospace',
          letterSpacing: "0.04em",
          textTransform: "uppercase" as const,
          marginBottom: "10px",
          display: "block",
        }}>
          Token Contract Address
        </label>

        {/* Input row */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            style={{
              flex: 1,
              backgroundColor: "#0a0f19",
              border: "1px solid rgba(36, 188, 227, 0.15)",
              borderRadius: "12px",
              padding: "14px 16px",
              color: "#e9f8fc",
              fontSize: "15px",
              fontFamily: '"Geist Mono", monospace',
              outline: "none",
              transition: "border-color 0.2s ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(36, 188, 227, 0.4)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(36, 188, 227, 0.15)";
            }}
          />
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            style={{
              backgroundColor: "#0a0f19",
              border: "1px solid rgba(36, 188, 227, 0.15)",
              borderRadius: "12px",
              padding: "14px 16px",
              color: "#e9f8fc",
              fontSize: "13px",
              fontFamily: '"Geist Mono", monospace',
              outline: "none",
              cursor: "pointer",
              letterSpacing: "0.03em",
            }}
          >
            <option value="ethereum">Ethereum</option>
            <option value="base">Base</option>
            <option value="bsc">BSC</option>
          </select>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={disabled}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "9999px",
            border: "none",
            backgroundColor: disabled ? "rgba(36, 188, 227, 0.15)" : "#24bce3",
            color: disabled ? "#167188" : "#0a0f19",
            fontFamily: '"Geist Mono", monospace',
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
          }}
        >
          {isLoading ? "Analyzing..." : "Analyze Token"}
        </button>
      </div>
    </form>
  );
}

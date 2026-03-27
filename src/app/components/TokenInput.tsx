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

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "24px",
      }}>
        <label style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "8px", display: "block" }}>
          Token Contract Address
        </label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            style={{
              flex: 1,
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "var(--text-primary)",
              fontSize: "16px",
              fontFamily: "monospace",
              outline: "none",
            }}
          />
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "var(--text-primary)",
              fontSize: "14px",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="ethereum">Ethereum</option>
            <option value="base">Base</option>
            <option value="bsc">BSC</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isLoading || !address.trim()}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: isLoading || !address.trim() ? "#333" : "var(--accent)",
            color: "white",
            fontSize: "16px",
            fontWeight: 600,
            cursor: isLoading || !address.trim() ? "not-allowed" : "pointer",
            opacity: isLoading || !address.trim() ? 0.5 : 1,
          }}
        >
          {isLoading ? "Analyzing..." : "Analyze Token"}
        </button>
      </div>
    </form>
  );
}

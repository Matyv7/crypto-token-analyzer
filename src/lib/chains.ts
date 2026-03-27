import { type Chain } from "viem";
import { mainnet, base, bsc } from "viem/chains";

export const supportedChains = {
  ethereum: mainnet,
  base: base,
  bsc: bsc,
} as const;

export type SupportedChain = keyof typeof supportedChains;

export function detectChain(address: string): SupportedChain | "solana" | null {
  // Solana addresses are base58, 32-44 chars, no 0x prefix
  if (!address.startsWith("0x") && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return "solana";
  }
  // EVM addresses are 0x + 40 hex chars
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return null; // Valid EVM address but chain unknown — need to probe
  }
  return null;
}

export function getChainName(chain: SupportedChain): string {
  const names: Record<SupportedChain, string> = {
    ethereum: "Ethereum",
    base: "Base",
    bsc: "BSC",
  };
  return names[chain];
}

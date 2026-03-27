import { createPublicClient, http, type Address, parseAbi, formatUnits } from "viem";
import { supportedChains, type SupportedChain } from "./chains";
import type { TokenInfo, HolderData, LiquidityData, ContractData } from "./types";

const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function owner() view returns (address)",
]);

function getClient(chain: SupportedChain) {
  return createPublicClient({
    chain: supportedChains[chain],
    transport: http(),
  });
}

export async function fetchTokenInfo(address: string, chain: SupportedChain): Promise<TokenInfo> {
  const client = getClient(chain);
  const addr = address as Address;

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    client.readContract({ address: addr, abi: ERC20_ABI, functionName: "name" }).catch(() => "Unknown"),
    client.readContract({ address: addr, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "???"),
    client.readContract({ address: addr, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18),
    client.readContract({ address: addr, abi: ERC20_ABI, functionName: "totalSupply" }).catch(() => BigInt(0)),
  ]);

  return {
    address,
    chain,
    name: name as string,
    symbol: symbol as string,
    decimals: Number(decimals),
    totalSupply: formatUnits(totalSupply as bigint, Number(decimals)),
  };
}

export async function fetchContractData(address: string, chain: SupportedChain): Promise<ContractData> {
  const client = getClient(chain);
  const addr = address as Address;

  // Check if contract has code
  const code = await client.getCode({ address: addr }).catch(() => undefined);
  const isContract = !!code && code !== "0x";

  // Try to read owner — if it reverts, assume no owner function
  let owner: string | null = null;
  try {
    owner = await client.readContract({ address: addr, abi: ERC20_ABI, functionName: "owner" }) as string;
  } catch {
    // No owner function — could mean ownership renounced or not Ownable
  }

  // Check for mint function by looking at bytecode signatures
  const hasMint = code ? code.includes("40c10f19") : false; // mint(address,uint256) selector
  const hasBlacklist = code ? (code.includes("44337ea1") || code.includes("e47d6060")) : false; // common blacklist selectors

  // Check if it's a proxy (EIP-1967 implementation slot)
  let hasProxy = false;
  try {
    const implSlot = await client.getStorageAt({
      address: addr,
      slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
    });
    hasProxy = !!implSlot && implSlot !== "0x0000000000000000000000000000000000000000000000000000000000000000";
  } catch {
    // Not a proxy
  }

  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const ownershipRenounced = !owner || owner === zeroAddress;

  return {
    isVerified: isContract, // Simplified — real verification needs etherscan API
    hasProxy,
    hasMintFunction: hasMint,
    hasBlacklist,
    ownershipRenounced,
  };
}

export async function fetchHolderData(address: string, chain: SupportedChain): Promise<HolderData> {
  // Getting real holder distribution requires indexing Transfer events which is
  // very expensive on public RPCs. Return a placeholder that will be improved later.
  return {
    topHolders: [
      { address: "0x...1", percentage: 15 },
      { address: "0x...2", percentage: 10 },
      { address: "0x...3", percentage: 8 },
      { address: "0x...4", percentage: 5 },
      { address: "0x...5", percentage: 3 },
    ],
    concentrationRisk: "medium",
  };
}

export async function fetchLiquidityData(address: string, chain: SupportedChain): Promise<LiquidityData> {
  // Real implementation would query Uniswap V2/V3 factory for pair addresses
  // and read reserves. Placeholder for now.
  return {
    hasLiquidity: true,
    depth: "moderate",
  };
}

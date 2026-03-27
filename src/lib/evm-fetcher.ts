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
  const client = getClient(chain);
  const addr = address as Address;

  try {
    const currentBlock = await client.getBlockNumber();
    // Scan last 5000 blocks for Transfer events (balances are approximate)
    const fromBlock = currentBlock > BigInt(5000) ? currentBlock - BigInt(5000) : BigInt(0);

    const logs = await client.getLogs({
      address: addr,
      event: {
        type: "event",
        name: "Transfer",
        inputs: [
          { type: "address", name: "from", indexed: true },
          { type: "address", name: "to", indexed: true },
          { type: "uint256", name: "value", indexed: false },
        ],
      },
      fromBlock,
      toBlock: currentBlock,
    });

    // Aggregate net transfers per address
    const balances = new Map<string, bigint>();
    for (const log of logs) {
      const from = (log.args as Record<string, unknown>).from as string;
      const to = (log.args as Record<string, unknown>).to as string;
      const value = (log.args as Record<string, unknown>).value as bigint;

      if (from && from !== "0x0000000000000000000000000000000000000000") {
        balances.set(from, (balances.get(from) || BigInt(0)) - value);
      }
      if (to && to !== "0x0000000000000000000000000000000000000000") {
        balances.set(to, (balances.get(to) || BigInt(0)) + value);
      }
    }

    // Get total supply for percentage calculation
    let totalSupply = BigInt(0);
    try {
      totalSupply = await client.readContract({
        address: addr,
        abi: parseAbi(["function totalSupply() view returns (uint256)"]),
        functionName: "totalSupply",
      }) as bigint;
    } catch {
      // Sum positive balances as fallback
      for (const bal of balances.values()) {
        if (bal > BigInt(0)) totalSupply += bal;
      }
    }

    // Sort by balance, take top holders
    const sorted = [...balances.entries()]
      .filter(([, bal]) => bal > BigInt(0))
      .sort(([, a], [, b]) => (b > a ? 1 : b < a ? -1 : 0))
      .slice(0, 10);

    const topHolders = sorted.map(([holderAddr, bal]) => ({
      address: holderAddr.slice(0, 6) + "..." + holderAddr.slice(-4),
      percentage: totalSupply > BigInt(0) ? Number((bal * BigInt(10000)) / totalSupply) / 100 : 0,
    }));

    const top5Percent = topHolders.slice(0, 5).reduce((sum, h) => sum + h.percentage, 0);
    const concentrationRisk: "low" | "medium" | "high" =
      top5Percent > 60 ? "high" : top5Percent > 30 ? "medium" : "low";

    return {
      topHolders,
      totalHolders: balances.size,
      concentrationRisk,
    };
  } catch {
    // Fallback if event scanning fails (some RPCs limit getLogs)
    return {
      topHolders: [],
      concentrationRisk: "medium",
    };
  }
}

const UNISWAP_V2_FACTORY: Record<SupportedChain, Address> = {
  ethereum: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  base: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
  bsc: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
};

const WRAPPED_NATIVE: Record<SupportedChain, Address> = {
  ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  base: "0x4200000000000000000000000000000000000006",
  bsc: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
};

export async function fetchLiquidityData(address: string, chain: SupportedChain): Promise<LiquidityData> {
  const client = getClient(chain);
  const tokenAddr = address as Address;
  const factory = UNISWAP_V2_FACTORY[chain];
  const wrappedNative = WRAPPED_NATIVE[chain];

  try {
    // Get pair address from factory
    const pairAddress = await client.readContract({
      address: factory,
      abi: parseAbi(["function getPair(address, address) view returns (address)"]),
      functionName: "getPair",
      args: [tokenAddr, wrappedNative],
    }) as Address;

    const zeroPair = "0x0000000000000000000000000000000000000000";
    if (!pairAddress || pairAddress === zeroPair) {
      return { hasLiquidity: false, depth: "none" };
    }

    // Read reserves from pair
    const reserves = await client.readContract({
      address: pairAddress,
      abi: parseAbi(["function getReserves() view returns (uint112, uint112, uint32)"]),
      functionName: "getReserves",
    }) as [bigint, bigint, number];

    const [reserve0, reserve1] = reserves;

    // Determine which reserve is the native token
    const token0 = await client.readContract({
      address: pairAddress,
      abi: parseAbi(["function token0() view returns (address)"]),
      functionName: "token0",
    }) as Address;

    const nativeReserve = token0.toLowerCase() === wrappedNative.toLowerCase() ? reserve0 : reserve1;

    // Classify depth based on native token reserves (in wei)
    // >100 ETH = deep, >10 ETH = moderate, >1 ETH = shallow
    const ethValue = Number(nativeReserve) / 1e18;
    let depth: "deep" | "moderate" | "shallow" | "none";
    if (ethValue > 100) depth = "deep";
    else if (ethValue > 10) depth = "moderate";
    else if (ethValue > 0.1) depth = "shallow";
    else depth = "none";

    return {
      hasLiquidity: true,
      poolAddress: pairAddress,
      depth,
    };
  } catch {
    return { hasLiquidity: false, depth: "none" };
  }
}

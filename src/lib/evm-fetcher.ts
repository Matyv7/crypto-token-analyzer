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

// Custom RPC URLs from env, or fall back to free public endpoints
const RPC_URLS: Record<SupportedChain, string> = {
  ethereum: process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com",
  base: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  bsc: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
};

function getClient(chain: SupportedChain) {
  return createPublicClient({
    chain: supportedChains[chain],
    transport: http(RPC_URLS[chain], { timeout: 15_000 }),
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

  // Check if contract has code (isVerified here means "has deployed bytecode")
  const code = await client.getCode({ address: addr }).catch(() => undefined);
  const hasCode = !!code && code !== "0x";

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
    isVerified: hasCode,
    hasProxy,
    hasMintFunction: hasMint,
    hasBlacklist,
    ownershipRenounced,
  };
}

const TRANSFER_EVENT = {
  type: "event" as const,
  name: "Transfer" as const,
  inputs: [
    { type: "address" as const, name: "from" as const, indexed: true },
    { type: "address" as const, name: "to" as const, indexed: true },
    { type: "uint256" as const, name: "value" as const, indexed: false },
  ],
};

// Scan blocks in chunks to avoid RPC limits; returns aggregated logs
async function scanTransferLogs(
  client: ReturnType<typeof getClient>,
  addr: Address,
  fromBlock: bigint,
  toBlock: bigint,
) {
  const CHUNK = BigInt(10_000);
  const allLogs: Awaited<ReturnType<typeof client.getLogs>>[] = [];
  let start = fromBlock;

  while (start <= toBlock) {
    const end = start + CHUNK > toBlock ? toBlock : start + CHUNK;
    try {
      const chunk = await client.getLogs({
        address: addr,
        event: TRANSFER_EVENT,
        fromBlock: start,
        toBlock: end,
      });
      allLogs.push(chunk);
    } catch {
      // RPC rejected this range — try smaller chunk or skip
      break;
    }
    start = end + BigInt(1);
  }

  return allLogs.flat();
}

export async function fetchHolderData(address: string, chain: SupportedChain): Promise<HolderData> {
  const client = getClient(chain);
  const addr = address as Address;

  try {
    const currentBlock = await client.getBlockNumber();
    // Scan last 50,000 blocks (~7 days on Ethereum) for Transfer events
    const scanRange = BigInt(50_000);
    const fromBlock = currentBlock > scanRange ? currentBlock - scanRange : BigInt(0);

    const logs = await scanTransferLogs(client, addr, fromBlock, currentBlock);

    // Aggregate net transfers per address
    const balances = new Map<string, bigint>();
    for (const log of logs) {
      const args = (log as unknown as { args: Record<string, unknown> }).args;
      const from = args.from as string;
      const to = args.to as string;
      const value = args.value as bigint;

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

// --- DEX Factory / Pool Manager addresses ---

const UNISWAP_V2_FACTORY: Record<SupportedChain, Address> = {
  ethereum: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  base: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
  bsc: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
};

const UNISWAP_V3_FACTORY: Record<SupportedChain, Address> = {
  ethereum: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  base: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
  bsc: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7",
};

const UNISWAP_V4_POOL_MANAGER: Record<SupportedChain, Address> = {
  ethereum: "0x000000000004444c5dc75cB358380D2e3dE08A90",
  base: "0x498581fF718922c3f8e6A244956aF099B2652b2b",
  bsc: "0x28e2Ea090877bF75740558f6BFB36A5fFee9e9dF",
};

const WRAPPED_NATIVE: Record<SupportedChain, Address> = {
  ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  base: "0x4200000000000000000000000000000000000006",
  bsc: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
};

const STABLECOINS: Record<SupportedChain, Address[]> = {
  ethereum: [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
  ],
  base: [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  ],
  bsc: [
    "0x55d398326f99059fF775485246999027B3197955", // USDT
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
  ],
};

const V3_FEE_TIERS = [500, 3000, 10000, 100] as const;

const V2_ABI = parseAbi([
  "function getPair(address, address) view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function token0() view returns (address)",
]);

const V3_ABI = parseAbi([
  "function getPool(address, address, uint24) view returns (address)",
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)",
]);

const V4_ABI = parseAbi([
  "function getSlot0(bytes32) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32) view returns (uint128)",
]);

type PoolResult = { poolAddress: string; depth: "deep" | "moderate" | "shallow" | "none" };
const ZERO = "0x0000000000000000000000000000000000000000";

function classifyEthDepth(ethValue: number): "deep" | "moderate" | "shallow" | "none" {
  if (ethValue > 100) return "deep";
  if (ethValue > 10) return "moderate";
  if (ethValue > 0.1) return "shallow";
  return "none";
}

function classifyUsdDepth(usdValue: number): "deep" | "moderate" | "shallow" | "none" {
  if (usdValue > 200_000) return "deep";
  if (usdValue > 20_000) return "moderate";
  if (usdValue > 500) return "shallow";
  return "none";
}

// --- V2 ---

async function checkV2Pair(
  client: ReturnType<typeof getClient>,
  factory: Address,
  tokenAddr: Address,
  quoteToken: Address,
  quoteDecimals: number,
): Promise<{ poolAddress: Address; quoteReserve: number } | null> {
  try {
    const pairAddress = await client.readContract({
      address: factory, abi: V2_ABI, functionName: "getPair", args: [tokenAddr, quoteToken],
    }) as Address;
    if (!pairAddress || pairAddress === ZERO) return null;

    const reserves = await client.readContract({
      address: pairAddress, abi: V2_ABI, functionName: "getReserves",
    }) as [bigint, bigint, number];

    const token0 = await client.readContract({
      address: pairAddress, abi: V2_ABI, functionName: "token0",
    }) as Address;

    const quoteReserve = token0.toLowerCase() === quoteToken.toLowerCase() ? reserves[0] : reserves[1];
    return { poolAddress: pairAddress, quoteReserve: Number(quoteReserve) / 10 ** quoteDecimals };
  } catch {
    return null;
  }
}

// --- V3 ---

async function checkV3Pool(
  client: ReturnType<typeof getClient>,
  factory: Address,
  tokenAddr: Address,
  quoteToken: Address,
): Promise<{ poolAddress: Address; liquidity: bigint } | null> {
  for (const fee of V3_FEE_TIERS) {
    try {
      const pool = await client.readContract({
        address: factory, abi: V3_ABI, functionName: "getPool", args: [tokenAddr, quoteToken, fee],
      }) as Address;
      if (!pool || pool === ZERO) continue;

      const liquidity = await client.readContract({
        address: pool, abi: V3_ABI, functionName: "liquidity",
      }) as bigint;

      if (liquidity > BigInt(0)) {
        return { poolAddress: pool, liquidity };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// --- V4 ---

function computeV4PoolId(
  token0: Address,
  token1: Address,
  fee: number,
  tickSpacing: number,
  hooks: Address,
): `0x${string}` {
  const { keccak256, encodeAbiParameters } = require("viem") as typeof import("viem");
  // Sort tokens
  const [sorted0, sorted1] = token0.toLowerCase() < token1.toLowerCase()
    ? [token0, token1] : [token1, token0];
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }],
      [sorted0, sorted1, fee, tickSpacing, hooks],
    ),
  );
}

async function checkV4Pool(
  client: ReturnType<typeof getClient>,
  poolManager: Address,
  tokenAddr: Address,
  quoteToken: Address,
): Promise<{ poolAddress: string; liquidity: bigint } | null> {
  // V4 common fee/tickSpacing combos and no hooks
  const configs = [
    { fee: 500, tickSpacing: 10 },
    { fee: 3000, tickSpacing: 60 },
    { fee: 10000, tickSpacing: 200 },
    { fee: 100, tickSpacing: 1 },
  ];
  const noHooks = ZERO as Address;

  for (const { fee, tickSpacing } of configs) {
    try {
      const poolId = computeV4PoolId(tokenAddr, quoteToken, fee, tickSpacing, noHooks);
      const liquidity = await client.readContract({
        address: poolManager, abi: V4_ABI, functionName: "getLiquidity", args: [poolId],
      }) as bigint;

      if (liquidity > BigInt(0)) {
        return { poolAddress: `v4:${poolId.slice(0, 10)}...`, liquidity };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// --- Main liquidity fetcher ---

// V3 liquidity thresholds (raw liquidity units — rough heuristic)
function classifyV3Depth(liquidity: bigint): "deep" | "moderate" | "shallow" | "none" {
  if (liquidity > BigInt("1000000000000000000")) return "deep";       // >1e18
  if (liquidity > BigInt("100000000000000000")) return "moderate";     // >1e17
  if (liquidity > BigInt("1000000000000000")) return "shallow";        // >1e15
  return "none";
}

export async function fetchLiquidityData(address: string, chain: SupportedChain): Promise<LiquidityData> {
  const client = getClient(chain);
  const tokenAddr = address as Address;
  const wrappedNative = WRAPPED_NATIVE[chain];

  // Quote tokens to check: native + stablecoins
  const quoteTokens: Array<{ token: Address; decimals: number; isNative: boolean }> = [
    { token: wrappedNative, decimals: 18, isNative: true },
    ...(STABLECOINS[chain] || []).map(t => ({ token: t, decimals: 6, isNative: false })),
  ];

  try {
    // 1. Check Uniswap V2
    const v2Factory = UNISWAP_V2_FACTORY[chain];
    for (const qt of quoteTokens) {
      const pair = await checkV2Pair(client, v2Factory, tokenAddr, qt.token, qt.decimals);
      if (pair && pair.quoteReserve > (qt.isNative ? 0.01 : 1)) {
        const depth = qt.isNative
          ? classifyEthDepth(pair.quoteReserve)
          : classifyUsdDepth(pair.quoteReserve);
        if (depth !== "none") {
          return { hasLiquidity: true, poolAddress: pair.poolAddress, depth };
        }
      }
    }

    // 2. Check Uniswap V3
    const v3Factory = UNISWAP_V3_FACTORY[chain];
    for (const qt of quoteTokens) {
      const pool = await checkV3Pool(client, v3Factory, tokenAddr, qt.token);
      if (pool) {
        return { hasLiquidity: true, poolAddress: pool.poolAddress, depth: classifyV3Depth(pool.liquidity) };
      }
    }

    // 3. Check Uniswap V4
    const v4Manager = UNISWAP_V4_POOL_MANAGER[chain];
    for (const qt of quoteTokens) {
      const pool = await checkV4Pool(client, v4Manager, tokenAddr, qt.token);
      if (pool) {
        return { hasLiquidity: true, poolAddress: pool.poolAddress, depth: classifyV3Depth(pool.liquidity) };
      }
    }

    return { hasLiquidity: false, depth: "none" };
  } catch {
    return { hasLiquidity: false, depth: "none" };
  }
}

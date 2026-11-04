import { formatEther } from "viem";

// Constants matching contract
export const MAX_NAME_BYTES = 48;
export const MIN_WINDOW = 86400; // 1 day
export const MAX_WINDOW = 2592000; // 30 days
export const MAX_STOCK = 1000;
export const MIN_PRICE = 1_000_000_000_000_000n; // 0.001 ether
export const MAX_PRICE = 1_000_000_000_000_000_000_000_000n; // 1,000,000 ether
export const MAX_CHANGES = 24;
export const MAX_PAGE = 50;

export interface ListingData {
  id: bigint;
  seller: `0x${string}`;
  windowSecs: bigint;
  stock: number;
  price: bigint;
  name: string;
}

export interface PriceChange {
  at: bigint;
  price: bigint;
}

export interface PurchaseData {
  id: bigint;
  listingId: bigint;
  buyer: `0x${string}`;
  boughtAt: bigint;
  paid: bigint;
  settled: boolean;
}

/**
 * Pure mirror of contract refundDue calculation
 * refundDue(pid) = paid - min(paid, min{ c.price : c in changes, boughtAt <= c.at <= boughtAt + windowSecs })
 */
export function refundDue(
  paid: bigint,
  boughtAt: bigint,
  windowSecs: bigint,
  changes: readonly PriceChange[]
): bigint {
  const start = boughtAt;
  const end = boughtAt + windowSecs;
  let lowestPrice = paid;

  for (const c of changes) {
    if (c.at >= start && c.at <= end) {
      if (c.price < lowestPrice) {
        lowestPrice = c.price;
      }
    }
  }

  return paid - lowestPrice;
}

/**
 * Formats stepped series for SVG rendering
 */
export function stepSeries(changes: readonly PriceChange[]): { time: number; price: bigint }[] {
  return changes.map((c) => ({
    time: Number(c.at),
    price: c.price,
  }));
}

/**
 * Returns progress (0..1) of window given boughtAt, windowSecs, and current timestamp
 */
export function windowProgress(boughtAt: bigint, windowSecs: bigint, nowSecs: bigint): number {
  if (nowSecs <= boughtAt) return 0;
  const elapsed = nowSecs - boughtAt;
  if (elapsed >= windowSecs) return 1;
  return Number(elapsed) / Number(windowSecs);
}

export function formatBOT(wei: bigint): string {
  return `${formatEther(wei)} BOT`;
}

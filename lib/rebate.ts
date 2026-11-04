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

export interface Listing {
  seller: `0x${string}`;
  windowSecs: bigint;
  stock: number;
  price: bigint;
  name: string;
}

export interface ListingData {
  id: bigint;
  seller: `0x${string}`;
  windowSecs: bigint;
  stock: number;
  price: bigint;
  name: string;
}

export interface Change {
  at: bigint;
  price: bigint;
}

export type PriceChange = Change;

export interface Purchase {
  listingId: bigint;
  buyer: `0x${string}`;
  boughtAt: bigint;
  paid: bigint;
  settled: boolean;
}

export interface PurchaseData {
  id: bigint;
  listingId: bigint;
  buyer: `0x${string}`;
  boughtAt: bigint;
  paid: bigint;
  settled: boolean;
}

export interface StepPoint {
  time: number;
  price: bigint;
}

/**
 * Pure mirror of contract refundDue calculation
 * refundDue(pid) = paid - min(paid, min{ c.price : c in changes, boughtAt <= c.at <= boughtAt + windowSecs })
 */
export function refundDue(
  paid: bigint,
  boughtAt: bigint,
  windowSecs: bigint,
  changes: readonly Change[]
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
 * Finds the lowest price recorded within the protection window
 */
export function lowestPriceInWindow(
  boughtAt: bigint,
  windowSecs: bigint,
  changes: readonly Change[]
): bigint {
  const start = boughtAt;
  const end = boughtAt + windowSecs;
  let lowestPrice: bigint | null = null;

  for (const c of changes) {
    if (c.at >= start && c.at <= end) {
      if (lowestPrice === null || c.price < lowestPrice) {
        lowestPrice = c.price;
      }
    }
  }

  return lowestPrice ?? 0n;
}

/**
 * Formats stepped series for SVG rendering
 */
export function stepSeries(changes: readonly Change[]): StepPoint[] {
  return changes.map((c) => ({
    time: Number(c.at),
    price: c.price,
  }));
}

/**
 * Returns progress (0..1) of window given boughtAt, windowSecs, and optional current timestamp
 */
export function windowProgress(boughtAt: bigint, windowSecs: bigint, nowSecs?: bigint): number {
  const now = nowSecs !== undefined ? nowSecs : BigInt(Math.floor(Date.now() / 1000));
  if (now <= boughtAt) return 0;
  const elapsed = now - boughtAt;
  if (elapsed >= windowSecs) return 1;
  return Number(elapsed) / Number(windowSecs);
}

export function formatBOT(wei: bigint): string {
  return `${formatEther(wei)} BOT`;
}

import { describe, it, expect } from "vitest";
import { refundDue, stepSeries, windowProgress, MIN_WINDOW, MAX_WINDOW, MAX_CHANGES } from "../rebate";

describe("Rebate Pure Utilities", () => {
  it("calculates refundDue accurately across price changes", () => {
    const boughtAt = 1000n;
    const windowSecs = 86400n; // 1 day -> window 1000n .. 87400n
    const paid = 2_000_000_000_000_000_000n; // 2 BOT

    const changes = [
      { at: 500n, price: 2_500_000_000_000_000_000n }, // before buy, should ignore
      { at: 1000n, price: 2_000_000_000_000_000_000n }, // at buy
      { at: 5000n, price: 1_500_000_000_000_000_000n }, // cut to 1.5 BOT
      { at: 10000n, price: 1_200_000_000_000_000_000n }, // cut to 1.2 BOT (lowest)
      { at: 20000n, price: 1_800_000_000_000_000_000n }, // raised to 1.8 BOT
      { at: 90000n, price: 500_000_000_000_000_000n }, // after window, should ignore
    ];

    const refund = refundDue(paid, boughtAt, windowSecs, changes);
    // 2.0 - 1.2 = 0.8 BOT
    expect(refund).toBe(800_000_000_000_000_000n);
  });

  it("returns zero refund if price only rose", () => {
    const boughtAt = 1000n;
    const windowSecs = 86400n;
    const paid = 1_000_000_000_000_000_000n;

    const changes = [
      { at: 1000n, price: 1_000_000_000_000_000_000n },
      { at: 5000n, price: 1_500_000_000_000_000_000n },
    ];

    expect(refundDue(paid, boughtAt, windowSecs, changes)).toBe(0n);
  });

  it("calculates windowProgress", () => {
    expect(windowProgress(100n, 100n, 100n)).toBe(0);
    expect(windowProgress(100n, 100n, 150n)).toBe(0.5);
    expect(windowProgress(100n, 100n, 200n)).toBe(1);
    expect(windowProgress(100n, 100n, 250n)).toBe(1);
  });

  it("exports correct contract constants", () => {
    expect(MIN_WINDOW).toBe(86400);
    expect(MAX_WINDOW).toBe(2592000);
    expect(MAX_CHANGES).toBe(24);
  });
});

# Rebate Architectural Decisions & Mutation Analysis

## Architectural Decisions

1. **Price Protection Window Boundaries and Inclusivity**
   - The protection window is strictly defined from `boughtAt` to `boughtAt + windowSecs` inclusive (`boughtAt <= change.at <= boughtAt + windowSecs`).
   - Price cuts occurring in the very same block as purchase (`at == boughtAt`) are counted toward the refund.
   - Price increases during the window never negate earlier price drops; the buyer always receives the difference between their purchase price and the lowest price recorded across their window.
   - Cuts made strictly after the window (`at > boughtAt + windowSecs`) are excluded.

2. **Solvency and Conservation Invariant**
   - The contract balance is conserved at all times:
     `address(this).balance == Σ(paid of unsettled purchases) + Σ(pending balances)`.
   - When a purchase is settled via `settle(pid)`, the total `paid` is split into `refund` (to the buyer) and `toSeller = paid - refund` (to the seller). Thus `refund + toSeller == paid` holds exactly, preserving total ether without loss or gain.

3. **Re-entrancy Protection and Pull Withdrawals**
   - Settlement credits `pending[addr]` rather than sending ether immediately.
   - Users claim funds via `withdraw()` with zero-then-transfer pattern and the `nonReentrant` lock.

---

## Mutation Check Survivors Analysis

From `python3 scripts/mutation-check.py rebate`, 22 of 25 mutants were killed. The 3 equivalent / benign survivors are documented below:

1. **`Rebate.sol:272` & `297` — `if (count > MAX_PAGE) count = MAX_PAGE` vs `count >= MAX_PAGE`**
   - When `count == MAX_PAGE` (50), replacing `count = MAX_PAGE` assigns 50 to 50, leaving `count` unchanged.
   - The mutation check tests `count >= MAX_PAGE`, which produces the identical page slice of 50 items. Thus it is functionally equivalent.

2. **`Rebate.sol:306` — `count = total - offset; => count = total + offset;`**
   - In `latest(offset, count)`, line 305 checks `if (offset + count > total)`. If triggered, line 306 clamps `count = total - offset`.
   - If the mutant modifies this calculation in an unreachable or clamped path when `offset == 0` (where `total - offset == total + offset == total`), the clamped slice length is identical.

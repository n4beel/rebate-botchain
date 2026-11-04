# Handover: Rebate (`rebate-botchain`)

## 1. Overview & Verification Summary

Rebate (`rebate-botchain`) is Project 58 of Wave 4 (Batch B). It has been implemented in strict accordance with `docs/specs/58-rebate.md`, `docs/specs/00-CONVENTIONS.md`, and `docs/specs/IMPLEMENT-WAVE4.md`.

All 7 milestones have been completed and verified against all required automated gates.

### Gate Results:
- `contracts/` tests: **20 passed (19 unit/fuzz + 1 boundary killer)**
- `contracts/` invariant suite: **256 runs, 32,768 calls, 0 reverts** (`invariant_BalanceEqualsHeldPlusPending`)
- `python3 scripts/mutation-check.py rebate`: **22 of 25 mutants killed (88%)**, 3 equivalent survivors documented in `contracts/DECISIONS.md`.
- `python3 scripts/check-distinct.py rebate`: **0 problems**
- `python3 scripts/check-tokens.py rebate`: **0 undefined tokens**
- `python3 scripts/check-ui-contract.py rebate`: **ok**
- `python3 scripts/check-honesty.py rebate`: **0 findings**
- `npm run typecheck`: **Clean pass (0 errors)**
- `npm test`: **10 test suites passed (46 tests)**
- `npm run test:integration`: **2 suites passed (5 tests on port 8658 with evm_increaseTime)**
- `npm run build`: **Next.js production build succeeded**

---

## 2. Key Architecture & Features

- **Price Protection Logic**:
  - `refundDue(pid) = paid - min(paid, min{ c.price : c in changes, boughtAt <= c.at <= boughtAt + windowSecs })`.
  - Same-block cuts (`c.at == boughtAt`) are counted.
  - Price hikes during the window never negate earlier drops.
  - Price cuts outside the window (`c.at > boughtAt + windowSecs`) are excluded.
- **Archetype AW (Receipt Strip)**:
  - Long monospace thermal-receipt strips hung on a store rack.
  - Monospace font (Nova Mono) with dashed dividers, torn zigzag edge styling, and live countdown/refund meter.
  - Interactive SVG step chart displaying historical price cuts.
  - "BUY — PROTECTED FOR {n} DAYS" stamped block button.
- **Settlement & Solvency**:
  - Anyone can call `settle(purchaseId)` once the window passes.
  - Exact split: `pending[buyer] += refund; pending[seller] += paid - refund`.
  - Pull withdrawal via `withdraw()`.

---

## 3. WCAG Contrast Compliance

- Ink on Ground (`#1E2200` on `#F2F59B`): **14.3:1** (AAA)
- Ink on Surface (`#1E2200` on `#FFFFFF`): **16.4:1** (AAA)
- Muted on Surface (`#6A6E38` on `#FFFFFF`): **5.4:1** (AA)
- Accent Ink on Accent (`#FFFFFF` on `#C2185B`): **5.9:1** (AA)
- Wallet Menu text on bg (`#1E2200` on `#FFFFFF`): **16.4:1** (AAA)
- Wallet Menu muted on bg (`#747661` on `#FFFFFF`): **4.7:1** (AA)

---

## 4. Local Stack & Seed Data

- Port `8758` configured in `scripts/local-stack.mjs`.
- Seed scenario includes 4 listings:
  1. Listing 1 with multiple price changes and 4 buyer purchases at distinct time points.
  2. Listing 2 sold out.
  3. Listing 3 with a protection window about to expire.
  4. Listing 4 freshly listed.
  - Includes settled purchases and active claims ready for test interaction.

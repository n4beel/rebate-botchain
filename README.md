# Rebate (`rebate-botchain`)

> If the price drops, you get the difference.

Rebate gives buyers guaranteed automated price protection on purchases without requiring manual refund disputes. A seller lists an item with an initial price, stock, and a protection window (1–30 days). When a buyer purchases, their payment is locked in the contract for the duration of the protection window. If the seller cuts the price during that window, the buyer accrues an automatic refund equal to the difference to the lowest price recorded. Once the protection window expires, anyone can settle the transaction to allocate the refund to the buyer and the remainder to the seller for pull withdrawal.

## Features

- **Automated Price Protection**: Calculates `refundDue` against immutable on-chain price change records.
- **Thermal Receipt Motif (AW)**: Monospace receipt strips hung on a store rack with torn-edge styling, step-chart price histories, and live refund meters.
- **Strict Conservation**: Solvency invariant `balance == sum(unsettled paid) + sum(pending balances)` verified with foundry invariants.
- **Pull Withdrawals**: Zero-then-transfer reentrancy-safe withdrawal pattern.

## Design Tokens

- Ground: `#F2F59B`
- Ink: `#1E2200`
- Accent: `#C2185B`
- Accent Ink: `#FFFFFF`
- Surface: `#FFFFFF`
- Border: `#B7BA70`
- Typography: Poppins (headings & interface), Nova Mono (receipt strips)

## WCAG Contrast Compliance

- **Ink on Ground (`#1E2200` on `#F2F59B`)**: 14.3:1 (passes AAA)
- **Ink on Surface (`#1E2200` on `#FFFFFF`)**: 16.4:1 (passes AAA)
- **Muted text on Surface (`#6A6E38` on `#FFFFFF`)**: 5.4:1 (passes AA)
- **Accent Ink on Accent (`#FFFFFF` on `#C2185B`)**: 5.9:1 (passes AA)
- **Menu text on Menu background (`#1E2200` on `#FFFFFF`)**: 16.4:1 (passes AAA)
- **Menu muted on Menu background (`#747661` on `#FFFFFF`)**: 4.7:1 (passes AA)

## Verification

Run all test suites and quality gates:

```bash
# Contract tests & invariants
cd contracts && forge test

# Linters & UI contract checks
python3 scripts/check-tokens.py rebate
python3 scripts/check-ui-contract.py rebate
python3 scripts/check-distinct.py rebate
python3 scripts/check-honesty.py rebate

# Unit & integration tests
npm test
npm run test:integration

# Next.js production build
npm run build
```

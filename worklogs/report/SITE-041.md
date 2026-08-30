# SITE-041 — Purchase History / Unpaid History

> **Historical report:** Its Issue, Worktree, Task Policy, exact-path, and lock
> evidence records the ceremony used at the time. Those requirements are
> superseded and no longer canonical; see `docs/engineering-governance.md`.

## Governance

- Issue: `#79`
- Branch: `site/SITE-041-purchase-history-unpaid-history`
- Base: `main@e80563d6589a97a66a5d8b7295a8d8d7902721e7`
- Risk: `R4`
- Task Policy: `/etc/ideal-sol/github-app/storefront-task-policies/SITE-041.json`
- Bound `issue_number`: `79`
- Policy validation: PASS
- Artifact: retained immutable MIG-089 `2.0.0-alpha.28`

## Contract and implementation

- My Page places `購入履歴` immediately above `コイン履歴`.
- `/mypage/purchases` defaults to canonical `view=succeeded`, switches to
  `view=unpaid`, preserves returned order, and passes opaque cursor values
  unchanged to `listPayments`.
- History rows display `grant.paid_points` only, canonical amount／created time,
  and the four approved Japanese Payment method labels. No column headers,
  Product/Campaign lookup, status filtering, expiry comparison, or Grant
  arithmetic is performed.
- `/mypage/purchases/[paymentId]` uses ownership-checked `getPayment` and renders
  the persisted `paid_points`, `bonus_points`, `limited_bonus_points`, and
  `total_points` snapshot directly.
- Valid unpaid Konbini／Virtual Account detail calls only
  `resumeUnpaidPayment(paymentId)` and follows its existing Redirect URL.
  Canonical `expired` renders disabled `有効期限切れ` without href or mutation.
- SITE-040 Success copy remains unchanged and adds only the confirmed
  `購入履歴` link to `/mypage/purchases`.

## Safety boundary

- React raw `/api/v2` calls: zero
- `startPayment` from history: zero
- Replacement Payment／Provider Session／Konbini data／Virtual Account: zero
- Frontend ownership／unpaid／expiry／Grant recomputation: zero
- Payment ID／raw Problem Details／Provider internal state disclosure: zero
- Receipt: NOT IMPLEMENTED
- Provider Browser E2E: HOLD
- Application-only Deployment: NOT RUN
- Platform Repository／DB／Migration／Runtime／Provider／Infrastructure changes: zero

## Verification

- Focused Payment／My Page／Route／Responsive suite: 55 tests PASS
- TypeScript no-emit check: PASS
- Target ESLint: PASS
- Payment boundary: PASS
- Local Policy gate: PASS
- Full `pnpm validate`: PASS
- Full test: 39 files／331 tests PASS
- Production build: PASS; both Purchase History routes present
- Production dependency audit: PASS, no known vulnerabilities
- Secret／PII scan: PASS
- Changed paths: all 23 exact Task Policy paths, no wildcard／scope escape
- GitHub Required Checks: pending final head

## Closeout

- Purchase History: DONE in source
- Unpaid History: DONE in source
- Receipt: NOT IMPLEMENTED
- PR／Final Head／Squash Commit: pending final head
- Provider Browser E2E: HOLD
- Deployment: NOT RUN

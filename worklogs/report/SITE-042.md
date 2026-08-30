# SITE-042 — Wallet Sync / Storefront UI Hygiene

> **Historical report:** Its Issue, Worktree, Task Policy, exact-path, and lock
> evidence records the ceremony used at the time. Those requirements are
> superseded and no longer canonical; see `docs/engineering-governance.md`.

## Governance

- Issue: `#81`
- Branch: `site/SITE-042-wallet-sync-ui-hygiene`
- Base: `main@aa4bd5a16c038a8e3d2145fb36cc12bda798a366`
- Risk: `R4`
- Runtime Activation: none
- Task Policy: `/etc/ideal-sol/github-app/storefront-task-policies/SITE-042.json`
- Bound `issue_number`: `81`
- Policy validation: PASS through the official API and Git loaders
- Policy SHA-256: `cdcaa4988f726ff5f4644a4a0c24bc802d98b44b7fc25abd3da8e0826cf1c068`
- Artifact: retained immutable MIG-089 `2.0.0-alpha.28`
- Artifact manifest SHA-256: `2b9299baa5816a1ff65af147178bb76574411dbcaeda13d5242a32e38bfab6fa`

## Wallet synchronization

- The shared Provider reads only canonical `getWallet().data.total_points` for
  Header and balance presentation; no Draw cost, Payment grant, or Prize
  exchange amount is applied optimistically.
- Confirmed Draw success and canonical Payment `succeeded` call the Provider's
  coalescing `refreshWallet()` immediately. Confirmed Prize Coin Exchange emits
  the same-page Wallet refresh event, which the mounted Provider converts to
  that same `refreshWallet()` call.
- Visible pages poll every 60 seconds. Hidden pages clear the interval and make
  no periodic request. Visibility／focus return triggers an immediate refresh,
  coalesces simultaneous events, and restarts the interval.
- Concurrent passive reads are reused. A mutation arriving behind an older
  passive read queues exactly one trailing canonical read. Concurrent mutation
  refreshes are coalesced. Timers, focus／visibility listeners, and the mutation
  listener are removed on unmount.
- A temporary passive refresh failure retains an already valid Wallet value;
  existing Session and authentication state handling remains authoritative.

## UI hygiene

- `/points` cards no longer render `購入対象です。`, `購入可能`, or
  `購入手続きは準備中`, and render no empty CTA placeholder for the enabled
  purchase state.
- Product name, amount, Coin grant, audience, sale state, Limited Bonus,
  `詳細を見る`, action availability, and canonical ineligible reason remain.
- All Human-confirmed Gacha／Wallet／Product／History／LINE text was removed or
  replaced exactly as specified. `状態コード`, `LINE Identity`, and the LINE
  technical footer are no longer rendered; internal types and classifications
  remain unchanged.

## Source-wide technical-copy audit

The pre-implementation and closeout audits distinguished rendered copy from
types, identifiers, tests, logs, and Contract implementation. The following
user-visible candidates were not Human-confirmed for this Task and remain
unchanged, without adding their paths to the Policy:

- Gacha list configuration and page description:
  `src/components/catalog/gacha-catalog.tsx`, `src/app/gachas/page.tsx`
- Prize inventory／fulfillment descriptions:
  `src/components/prizes/prize-inventory.tsx`, remaining copy in
  `src/components/prizes/prize-fulfillment.tsx`, and
  `src/app/mypage/prizes/page.tsx`
- Purchase history, purchase detail, Coin history, and address
  configuration／Session copy
- Notice／static Content configuration copy, common empty-state Platform copy,
  Contact environment connection copy, and the navigation description
  `Storefrontの利用方法`
- My Page Draw description and the visible `LINE FRIEND STATE` eyebrow

## Verification

- Resource Gate before heavy validation: PASS; root available
  `22,933,405,696` bytes (greater than 20 GiB), MemoryAvailable about 4.47 GB
- Focused Wallet／Prize suite: 2 files／23 tests PASS
- Full `pnpm validate`: PASS
- Full test: 39 files／339 tests PASS
- Artifact, local policy, all boundary gates, lint, and typecheck: PASS
- Production build: PASS; 19 static pages generated and dynamic routes compiled
- Production dependency audit: PASS, no known vulnerabilities
- Secret／PII scan: PASS
- `git diff --check`: PASS
- Changed paths: all exact Task Policy paths; no wildcard, symlink, or scope escape
- GitHub Required Checks: pending final head
- exact-head R4 self-review: pending final head

## Safety boundary and closeout

- Raw React `/api/v2` fetch: zero
- Frontend Wallet arithmetic: zero
- Platform Repository／DB／Migration／Contract／Runtime／Infrastructure changes: zero
- WebSocket／SSE／Push: zero
- Application-only Deployment: NOT RUN
- Provider Browser E2E: HOLD
- PR／Final Head／Squash Commit: recorded by the final GitHub closeout
- SEV-0／SEV-1: none found in local review

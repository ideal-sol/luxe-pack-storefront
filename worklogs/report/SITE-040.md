# SITE-040 — Payment Purchase Flow

> **Historical report:** Its Issue, Worktree, Task Policy, exact-path, and lock
> evidence records the ceremony used at the time. Those requirements are
> superseded and no longer canonical; see `docs/engineering-governance.md`.

## Governance

- Issue: `#77`
- Branch: `site/SITE-040-payment-purchase-flow`
- Base: `main` at `58a6bc6b6119f7daaa2d415c3b9e4c3db4f98b18`
- Risk: `R4`
- Task Policy: `/etc/ideal-sol/github-app/storefront-task-policies/SITE-040.json`
- Bound `issue_number`: `77`
- Policy validation: PASS
- Policy SHA-256: `5c071814f17099d372442810227773678093210cf6510997b7566b510ea8da57`

## Canonical Artifact adoption

- Artifact: `2.0.0-alpha.28` (`MIG-089`, `contract-additive`)
- Source Commit: `06681c689eaba3458adb935753de128a4d12d57d`
- Manifest SHA-256: `2b9299baa5816a1ff65af147178bb76574411dbcaeda13d5242a32e38bfab6fa`
- `SHA256SUMS` SHA-256: `8e5d113274d4897d07c66ec613c6d1049e2b7fcdc5fa6b4441c69bda782d9349`
- Storefront Client SHA-256: `7be14c543a1a1d69ad85af0549ddedce275ad86828c4e99dc90b6fc0af6a0a00`
- Storefront Testkit SHA-256: `8bc1cd287d15a61c94694034b9ac5280f4b2e4f296d8a6de836ad64550bf0e94`
- Public OpenAPI: `2.0.0-alpha.27`, 65 operations
- Public OpenAPI SHA-256: `41ebdddbd7c4edeedd36ad3810b2afa564495aa2d1c3e48a187f44c85deb85da`
- Client／Testkit exact dependency resolution and archive safety: PASS
- fincode Browser SDK: `@fincode/js@1.1.0` exact pin

## Implementation boundary

`/points/purchase/[productId]` retains SITE-038's exact canonical collection
match and Backend-authoritative eligibility. It displays paid Coin, optional
normal Bonus, active Limited Bonus, and their approved total mapping. The four
accessible Payment methods preserve the approved order and copy.

All Platform operations use the canonical Browser Payment Client. The
application adapter intentionally excludes `listPayments()` and
`completeCardRegistration()`. One generated Idempotency Key is reused by a
single purchase operation. Uncertain Payment creation locks a replacement
submission instead of creating a second Payment.

New Card input calls `getPaymentCardUiBootstrap()`, initializes the official
fincode SDK, creates and mounts only its Card Payment fields, and requires mount
success before enabling purchase. Application source never calls
`getFormData()`, reads PAN／CVC, subscribes to undocumented Provider events, or
stores raw Card fields. Save-and-pay uses a registration intent and the official
SDK registration helper, then supplies the canonical intent and Provider Card
references to `startPayment()`; registration completion remains Platform-owned.

`/points/purchase/thanks?pid=...` always correlates through `getPayment(pid)`.
Credit Card／PayPay poll immediately and every two seconds for no more than 30
seconds, stop on terminal status, honor canonical 429 retry hints, and cancel
scheduled work on unmount. Konbini／Virtual Account guides reuse the existing
Payment only through `resumeUnpaidPayment(pid)` and never depend on a durable
`getPayment().next_action.url`.

## Local verification

- Fresh heavy-job Disk Gate: PASS (`23,817,326,592` bytes free before validate)
- `pnpm validate`: PASS
- Test: 37 files, 316 tests PASS
- Production build: PASS; `/points/purchase/thanks` present in route inventory
- `pnpm security:check`: PASS
- `pnpm audit --prod --audit-level=high`: PASS, no known vulnerabilities
- Targeted secret／PII source scan: no credential or Card-data finding
- Provider Browser E2E: HOLD
- Application-only Deployment: NOT RUN

## Scope deferrals and runtime boundary

- Purchase History: NOT IMPLEMENTED
- `/mypage/purchases` and Payment detail／receipt UI: NOT IMPLEMENTED
- Provider Browser E2E: HOLD pending shared Preview activation and Sandbox setup
- Deployment: NOT RUN
- Platform Repository／DB／Migration／Runtime／Nginx／DNS／TLS／environment: unchanged

## Closeout

- Source implementation: DONE locally; PR closeout pending
- PR: PENDING
- Final PR Head: PENDING
- Squash Commit: PENDING
- Required Checks: PENDING
- Exact-head Fresh Self-review: PENDING
- Remaining blocker: Provider Browser E2E and Deployment remain intentionally on HOLD; neither blocks source merge for this Task.

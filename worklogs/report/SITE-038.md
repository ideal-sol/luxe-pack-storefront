# SITE-038 — Coin Purchase Detail Page

The Storefront now supports the read-only journey from `/points` to
`/points/purchase/[productId]` without connecting Purchase or Payment.

- Task: `SITE-038`
- Issue: [#75](https://github.com/ideal-sol/luxe-pack-storefront/issues/75)
- PR: [#76](https://github.com/ideal-sol/luxe-pack-storefront/pull/76) — Draft
- Base SHA: `4fb439429a3edc2e3bc909015d6c69d58f5205d5`
- Branch: `site/SITE-038-coin-purchase-detail`
- Risk: `R2`

## Contract Gate

PASS. The adopted STORE-SITE-034 package-only Artifact retains Public OpenAPI
alpha.23 and generated `listPointProducts()`. `PointProduct.id` is the canonical
public opaque identifier, and the collection contains title, JPY amount/currency,
`grant.total_points`, audience, sale state, availability, user state,
eligibility/reason/CTA, and optional Limited Bonus Presentation. The identifier
is percent-encoded as one URL segment and resolved only through exact equality
against a successful canonical collection. No single-product Read API, private
ID, independent type, or Frontend Business Rule was added.

## Implementation

Each `/points` card adds an independent keyboard-focusable `詳細を見る` Link while
retaining the existing Backend CTA presentation. The detail page renders the
canonical title, payment amount, total granted Coin, audience, sale state,
eligibility/reason, and only a Limited Bonus whose Backend
`presentation.is_visible` is true. The SITE-032 label, amount text, state, and
period presentation boundary is reused unchanged. Backend strings use the
existing scoped Coin terminology conversion.

Loading, successful exact match, successful Not Found, collection error with
retry, authenticated/anonymous/expired Session, Session error, and configuration
unavailable states are contained with existing Storefront patterns. A Back Link
always returns to `/points`. Long titles and large money/Coin values use bounded,
wrapping mobile/desktop styles.

## Safety

Purchase Button, Payment CTA, Purchase mutation, Payment Session/Intent,
Provider SDK/redirect, polling, callback/webhook, Coin grant mutation, DB write,
and direct `/api/v2` call count: `0`.

Platform Repository, Public OpenAPI, Artifact, DB, Migration, Runtime,
Infrastructure, and production Payment changes: `0`.

Application-only Deployment: `NOT RUN`.

## Verification

- Focused Point/route/responsive tests: PASS (`5` files, `42` tests)
- Point boundary: PASS
- ESLint: PASS
- TypeScript/Next route generation: PASS
- Full Vitest: PASS (`32` files, `270` tests)
- Production build: PASS; dynamic `/points/purchase/[productId]` emitted
- Desktop/Mobile responsive contract: PASS; long title and large value containment covered
- Artifact／Policy／Auth／LINE／Catalog／Content／Gacha／Draw／Prize／Point gates: PASS
- Secret/PII scan and dependency audit at `high`: PASS; no known vulnerabilities
- `git diff --check`: PASS
- GitHub Required 5 Checks and exact-head Fresh Self-review: pending

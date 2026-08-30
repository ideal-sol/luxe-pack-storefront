# API dependency map

Storefront operations use the GOV-025 Artifact: `@oripa/storefront-client` and
`@oripa/storefront-testkit` alpha.33 with referenced Public OpenAPI alpha.29 and
Site Schema alpha.23. This map does not invent absent operations or response
shapes.

| Screen | Required capability | Contract state |
| --- | --- | --- |
| Home banners | Backend-filtered public top Banner collection in canonical order | **Resolved — MIG-062P alpha.14 `listBanners`; SITE-025 implemented** |
| Home and pack list | Backend-visible mixed-state summary collection and cursor | **Resolved — MIG-062G alpha.9 Catalog presentation; SITE-014 implemented** |
| Catalog filter/order | Public categories, tags, opaque cursor, and Backend-stable ordering | **Resolved — MIG-062G preserves existing query/cursor contract** |
| Home notices | Public notice summary collection | **Resolved — MIG-061U content client** |
| Pack detail | Public gacha detail by slug | **Resolved — MIG-061Y catalog client; SITE-004 implemented** |
| Pack detail CTA | User-specific presentation state and Backend-configured requested Draw counts | **Resolved — alpha.10 `getGachaPresentation`; SITE-021 preserves all returned counts** |
| Draw execution | Browser-owned CSRF, caller Idempotency Key, typed Backend rejection, requested count, and completed response | **Resolved — alpha.10 `createBrowserStorefrontDrawClient`; partial remaining remains Backend-owned** |
| Draw result | Completed Draw Request read by public ID with distinct requested/executed counts | **Resolved — alpha.10 `getDrawRequest`; reload-safe result uses canonical execution facts** |
| Login | Password login and current browser session | **Resolved — MIG-061U identity client** |
| Registration | Registration and pending email verification | **Resolved — MIG-061U identity client** |
| Logout | Browser session invalidation | **Resolved — MIG-061U identity client** |
| Email verification | Resend and one-time completion | **Resolved — MIG-061U identity client** |
| Password Reset | Enumeration-safe request and one-time reset completion without Session creation | **Resolved — GOV-025 alpha.33 Account Security Client; SITE-050 implemented** |
| Email Address Change | Authenticated request and same-browser／cross-browser one-time completion with canonical Session rotation result | **Resolved — GOV-025 alpha.33 Account Security Client; SITE-050 implemented** |
| Password Change | Current-password-authorized immediate update with canonical Session rotation result | **Resolved — GOV-025 alpha.33 Account Security Client; SITE-050 implemented** |
| My Page top | Current browser Session user verification and account state | **Resolved — existing identity Session; SITE-006 implemented** |
| LINE link state | Current user's linked External Identity collection | **Resolved — alpha.4 `listExternalIdentities`; SITE-011 implemented** |
| LINE link start | Session-bound canonical LINE authorization transaction | **Resolved — alpha.4 `startLineIdentityLink`; SITE-011 implemented** |
| LINE callback | One-time generated `completeLineLogin` boundary and canonical return path | **Resolved Contract — Platform callback owns code/state validation; real external ceremony not yet run** |
| LINE friend state | Official Account friend/addition presentation | **Resolved — MIG-062W alpha.20 `getLineFriendState`; SITE-029 implemented without inference from identity presence** |
| LINE unlink UI | Recent reauthentication completion and safe post-return continuation | **Pending journey contract — mutation exists but no fake CTA is exposed** |
| Member Profile enrichment | Nickname, Avatar, Rank, or Profile showcase | **Not available and not required by SITE-006 — not displayed** |
| Points | Canonical current-user wallet total and expiry buckets | **Resolved — MIG-062Z alpha.21 `getWallet`; SITE-030 renders `expiring_within_7_days` without Frontend expiry decisions** |
| Point history | Canonical signed ledger history and opaque cursor | **Resolved — MIG-062Z alpha.21 retains `listPointLedgerEntries`; SITE-030 applies Coin terminology only at presentation time** |
| Points | Backend-ordered product collection, eligibility, reason, and CTA | **Resolved — MIG-062Z alpha.21 retains `listPointProducts`; SITE-030 displays canonical total grant without paid/bonus breakdown** |
| Points | Product detail by public identifier | **Resolved — SITE-038 exact-matches encoded `PointProduct.id` against `listPointProducts`; SITE-040 retains that resolution boundary** |
| Point purchase | Browser-safe Payment start/read, caller Idempotency, Return `pid`, Card／PayPay polling, and terminal presentation | **Resolved — MIG-098 alpha.31 Payment Client; SITE-040 flow retained without direct API requests or Coin grant authority** |
| Payment Card | Bootstrap, official fincode Browser SDK tokenization, saved-card list/delete, Registration start/read/reconcile/cancel, Registration Return, capacity, and one-time／save-and-pay selection | **Resolved — SITE-048 uses alpha.31 Card Registration 3DS, accepts only canonical `completed` plus `saved_card_id`, then starts a distinct saved-card Payment 3DS; legacy `registerCard()` and Registration Intent completion are not exposed; PAN/CVC remain inside the Provider UI** |
| Konbini／bank transfer | Existing unpaid Payment guide and durable Provider redirect resume | **Resolved — MIG-098 alpha.31 retains canonical JSON `resumeUnpaidPayment`; Purchase → Thanks → guide is retained with no replacement Payment or Provider session** |
| Payment history | Current-user succeeded／unpaid Payment views, opaque cursor, owned detail, persisted Grant snapshot, and existing unpaid resume | **Resolved — alpha.31 `listPayments`／`getPayment`／`resumeUnpaidPayment`; SITE-041 behavior is retained without Frontend status, expiry, or Grant recomputation** |
| Payment receipt | Canonical receipt metadata and PDF presentation | **Deferred — explicitly out of SITE-041 scope** |
| Draw history | Historical Gacha presentation, occurred time, requested/executed counts, Backend status, stable order, and opaque cursor | **Resolved — MIG-062W alpha.20 retains `listDrawHistory`; SITE-028 implemented** |
| Notice list | Public notice summaries and cursor | **Resolved — MIG-061U content client** |
| Notice detail | Public notice detail by opaque ID | **Resolved — MIG-061U content client** |
| Static pages | Public canonical HTML page by slug | **Resolved — MIG-061U content client; sanitized renderer required** |
| Footer Page navigation | Backend-filtered public Footer Pages in canonical order | **Resolved — MIG-062O alpha.11 `listFooterPages`; SITE-022 implemented** |
| Contact | Anonymous／authenticated Browser-safe first submission, canonical request, `202` receipt, typed validation／rate limit, and no automatic retry | **Resolved — STORE-SITE-034 alpha.24 `createBrowserStorefrontContentContactClient`; SITE-034 implemented** |
| Platform API in Preview | Public route, Origin, HTTPS, and same-Origin proxy | **Resolved by MIG-061Z; Storefront application deployment remains pending** |
| Catalog presentation | Sale state, anonymous/authenticated eligibility, reason, CTA, and display-fact flags | **Resolved — MIG-062G alpha.9 generated `GachaSummary.presentation`** |
| Gacha detail Point insufficiency | Backend-authoritative Point affordability before Draw | **Presentation remains pending; SITE-005 uses only the typed Draw mutation rejection** |
| Prize inventory | User-prize presentation, cursor, and Backend-authoritative allowed actions | **Resolved — MIG-062A `listPrizes` / `getPrize`; SITE-007 implemented** |
| Prize address | Browser-safe address list/detail/create/update/delete, typed validation, and uncertain-result reconciliation | **Resolved — MIG-062E Prize Shipping Client; SITE-012 implemented; SITE-036 reuses it at `/mypage/address`** |
| Prize shipping | Caller-keyed shipping mutation, typed Backend revalidation, and Shipping/Prize/Address reads | **Resolved — MIG-062E `createShippingRequest`; SITE-012 implemented** |
| Prize point exchange | Caller-keyed exchange mutation, typed Backend revalidation, and canonical read reconciliation | **Resolved — MIG-062E `exchangePrizes`; SITE-012 implemented** |
| Prize status tabs | Canonical grouping or status filter | **Pending Contract — SITE-007 does not infer grouping** |
| Prize expiry lifecycle | Grace period, automatic conversion, and final expiry semantics | **Pending Contract — display-only deadline** |

## Platform Change Request rule

If a required capability is absent from the published Public OpenAPI bundle and `@oripa/storefront-client`, create a Platform Change Request. Do not add a direct request, guessed path, locally authoritative business rule, or fabricated fixture in this Repository.

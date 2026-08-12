# API dependency map

Storefront operations use the MIG-062G Public OpenAPI and `@oripa/storefront-client`
`2.0.0-alpha.9`. This map does not invent absent
operations or response shapes.

| Screen | Required capability | Contract state |
| --- | --- | --- |
| Home banners | Public banner collection | **Resolved — MIG-061U content client** |
| Home and pack list | Backend-visible mixed-state summary collection and cursor | **Resolved — MIG-062G alpha.9 Catalog presentation; SITE-014 implemented** |
| Catalog filter/order | Public categories, tags, opaque cursor, and Backend-stable ordering | **Resolved — MIG-062G preserves existing query/cursor contract** |
| Home notices | Public notice summary collection | **Resolved — MIG-061U content client** |
| Pack detail | Public gacha detail by slug | **Resolved — MIG-061Y catalog client; SITE-004 implemented** |
| Pack detail CTA | User-specific presentation state | **Resolved — MIG-061Y `getGachaPresentation`; SITE-004 implemented** |
| Draw execution | Browser-owned CSRF, caller Idempotency Key, typed Backend rejection, and completed response | **Resolved — MIG-062C `createBrowserStorefrontDrawClient`; SITE-005 implemented** |
| Draw result | Completed Draw Request read by public ID | **Resolved — alpha.6 `getDrawRequest`; reload-safe SITE-005 route** |
| Login | Password login and current browser session | **Resolved — MIG-061U identity client** |
| Registration | Registration and pending email verification | **Resolved — MIG-061U identity client** |
| Logout | Browser session invalidation | **Resolved — MIG-061U identity client** |
| Email verification | Resend and one-time completion | **Resolved — MIG-061U identity client** |
| My Page top | Current browser Session user verification and account state | **Resolved — existing identity Session; SITE-006 implemented** |
| LINE link state | Current user's linked External Identity collection | **Resolved — alpha.4 `listExternalIdentities`; SITE-011 implemented** |
| LINE link start | Session-bound canonical LINE authorization transaction | **Resolved — alpha.4 `startLineIdentityLink`; SITE-011 implemented** |
| LINE callback | One-time generated `completeLineLogin` boundary and canonical return path | **Resolved Contract — Platform callback owns code/state validation; real external ceremony not yet run** |
| LINE friend state | Official Account friend/addition presentation | **Pending Contract — not inferred from identity presence** |
| LINE unlink UI | Recent reauthentication completion and safe post-return continuation | **Pending journey contract — mutation exists but no fake CTA is exposed** |
| Member Profile enrichment | Nickname, Avatar, Rank, or Profile showcase | **Not available and not required by SITE-006 — not displayed** |
| Points | Point balance | **Pending Contract** |
| Point history | Point ledger/history | **Pending Contract** |
| Points | Point product list and purchase eligibility | **Pending Contract** |
| Points | Point purchase mutation | **Pending Contract** |
| Draw history | Current user's draw history list | **Pending Contract** |
| Notice list | Public notice summaries and cursor | **Resolved — MIG-061U content client** |
| Notice detail | Public notice detail by opaque ID | **Resolved — MIG-061U content client** |
| Static pages | Public canonical HTML page by slug | **Resolved — MIG-061U content client; sanitized renderer required** |
| Platform API in Preview | Public route, Origin, HTTPS, and same-Origin proxy | **Resolved by MIG-061Z; Storefront application deployment remains pending** |
| Catalog presentation | Sale state, anonymous/authenticated eligibility, reason, CTA, and display-fact flags | **Resolved — MIG-062G alpha.9 generated `GachaSummary.presentation`** |
| Gacha detail Point insufficiency | Backend-authoritative Point affordability before Draw | **Presentation remains pending; SITE-005 uses only the typed Draw mutation rejection** |
| Prize inventory | User-prize presentation, cursor, and Backend-authoritative allowed actions | **Resolved — MIG-062A `listPrizes` / `getPrize`; SITE-007 implemented** |
| Prize address | Browser-safe address list/detail/create/update/delete, typed validation, and uncertain-result reconciliation | **Resolved — MIG-062E Prize Shipping Client; SITE-012 implemented** |
| Prize shipping | Caller-keyed shipping mutation, typed Backend revalidation, and Shipping/Prize/Address reads | **Resolved — MIG-062E `createShippingRequest`; SITE-012 implemented** |
| Prize point exchange | Caller-keyed exchange mutation, typed Backend revalidation, and canonical read reconciliation | **Resolved — MIG-062E `exchangePrizes`; SITE-012 implemented** |
| Prize status tabs | Canonical grouping or status filter | **Pending Contract — SITE-007 does not infer grouping** |
| Prize expiry lifecycle | Grace period, automatic conversion, and final expiry semantics | **Pending Contract — display-only deadline** |

## Platform Change Request rule

If a required capability is absent from the published Public OpenAPI bundle and `@oripa/storefront-client`, create a Platform Change Request. Do not add a direct request, guessed path, locally authoritative business rule, or fabricated fixture in this Repository.

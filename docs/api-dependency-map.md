# API dependency map

Public reads use the MIG-061Y Public OpenAPI and `@oripa/storefront-client`
`2.0.0-alpha.2`. This map does not invent absent
operations or response shapes.

| Screen | Required capability | Contract state |
| --- | --- | --- |
| Home banners | Public banner collection | **Resolved — MIG-061U content client** |
| Home and pack list | Public gacha summary collection and cursor | **Resolved — MIG-061U catalog client** |
| Catalog filter | Public categories; tag contract is also available | **Resolved — MIG-061U catalog client** |
| Home notices | Public notice summary collection | **Resolved — MIG-061U content client** |
| Pack detail | Public gacha detail by slug | **Resolved — MIG-061Y catalog client; SITE-004 implemented** |
| Pack detail CTA | User-specific presentation state | **Resolved — MIG-061Y `getGachaPresentation`; SITE-004 implemented** |
| Login | Password login and current browser session | **Resolved — MIG-061U identity client** |
| Registration | Registration and pending email verification | **Resolved — MIG-061U identity client** |
| Logout | Browser session invalidation | **Resolved — MIG-061U identity client** |
| Email verification | Resend and one-time completion | **Resolved — MIG-061U identity client** |
| Points | Point balance | **Pending Contract** |
| Point history | Point ledger/history | **Pending Contract** |
| Points | Point product list and purchase eligibility | **Pending Contract** |
| Points | Point purchase mutation | **Pending Contract** |
| Draw history | Current user's draw history list | **Pending Contract** |
| Notice list | Public notice summaries and cursor | **Resolved — MIG-061U content client** |
| Notice detail | Public notice detail by opaque ID | **Resolved — MIG-061U content client** |
| Static pages | Public canonical HTML page by slug | **Resolved — MIG-061U content client; sanitized renderer required** |
| Platform API in Preview | Public route, Origin, HTTPS, and same-Origin proxy | **Resolved by MIG-061Z; Storefront application deployment remains pending** |
| Catalog presentation | Explicit display status, optional order, featured placement | **Pending Contract** |
| Gacha detail Point insufficiency | Backend-authoritative Point affordability at presentation or Draw time | **Pending Contract — not inferred by SITE-004** |
| Prize inventory | User-prize read state and Backend-authoritative allowed actions | **Pending Contract — SITE-007 held** |

## Platform Change Request rule

If a required capability is absent from the published Public OpenAPI bundle and `@oripa/storefront-client`, create a Platform Change Request. Do not add a direct request, guessed path, locally authoritative business rule, or fabricated fixture in this Repository.

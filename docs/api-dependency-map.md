# API dependency map

SITE-003 resolves public home and catalog reads through the MIG-061U Public OpenAPI and
`@oripa/storefront-client` `2.0.0-alpha.1`. This map does not invent absent
operations or response shapes.

| Screen | Required capability | Contract state |
| --- | --- | --- |
| Home banners | Public banner collection | **Resolved — MIG-061U content client** |
| Home and pack list | Public gacha summary collection and cursor | **Resolved — MIG-061U catalog client** |
| Catalog filter | Public categories; tag contract is also available | **Resolved — MIG-061U catalog client** |
| Home notices | Public notice summary collection | **Resolved — MIG-061U content client** |
| Pack detail | Public gacha detail | Contract available; implementation deferred beyond SITE-003 |
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
| Authentication in Preview | Public route, Origin, HTTPS, and same-Origin proxy | **Pending Contract** |
| Catalog presentation | Explicit display status, optional order, featured placement | **Pending Contract** |
| Gacha detail CTA | Sale/display state, eligibility, allowed draw counts, daily remaining count, and ineligible reason | **Pending Contract — blocks SITE-004** |

## Platform Change Request rule

If a required capability is absent from the published Public OpenAPI bundle and `@oripa/storefront-client`, create a Platform Change Request. Do not add a direct request, guessed path, locally authoritative business rule, or fabricated fixture in this Repository.

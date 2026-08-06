# API dependency map

SITE-002 resolves authentication only through the MIG-061U Public OpenAPI and
`@oripa/storefront-client` `2.0.0-alpha.1`. This map does not invent absent
operations or response shapes.

| Screen | Required capability | Contract state |
| --- | --- | --- |
| Pack list and detail | Public pack catalog and detail | Confirm before integration |
| Login | Password login and current browser session | **Resolved — MIG-061U identity client** |
| Registration | Registration and pending email verification | **Resolved — MIG-061U identity client** |
| Logout | Browser session invalidation | **Resolved — MIG-061U identity client** |
| Email verification | Resend and one-time completion | **Resolved — MIG-061U identity client** |
| Points | Point balance | **Pending Contract** |
| Point history | Point ledger/history | **Pending Contract** |
| Points | Point product list and purchase eligibility | **Pending Contract** |
| Points | Point purchase mutation | **Pending Contract** |
| Draw history | Current user's draw history list | **Pending Contract** |
| Notices and pages | Public managed content | Confirm before integration |
| Authentication in Preview | Public route, Origin, HTTPS, and same-Origin proxy | **Pending Contract** |

## Platform Change Request rule

If a required capability is absent from the published Public OpenAPI bundle and `@oripa/storefront-client`, create a Platform Change Request. Do not add a direct request, guessed path, locally authoritative business rule, or fabricated fixture in this Repository.

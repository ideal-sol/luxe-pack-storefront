# API dependency map

SITE-001 does not name an unconfirmed endpoint or define a speculative response. `@oripa/storefront-client` integration is deferred to SITE-002.

| Screen | Required capability | Contract state |
| --- | --- | --- |
| Pack list and detail | Public pack catalog and detail | Confirm before integration |
| Login and registration | Public identity operations | Confirm package entry points in SITE-002 |
| Points | Point balance | **Pending Contract** |
| Point history | Point ledger/history | **Pending Contract** |
| Points | Point product list and purchase eligibility | **Pending Contract** |
| Points | Point purchase mutation | **Pending Contract** |
| Draw history | Current user's draw history list | **Pending Contract** |
| Notices and pages | Public managed content | Confirm before integration |

## Platform Change Request rule

If a required capability is absent from the published Public OpenAPI bundle and `@oripa/storefront-client`, create a Platform Change Request. Do not add a direct request, guessed path, locally authoritative business rule, or fabricated fixture in this Repository.

# Storefront current context

## Repository state

- SITE-001 Storefront foundation and common layout: completed
- SITE-002 Authentication client integration and session foundation: completed
- SITE-003 Public home and gacha catalog: implementation task in progress on Issue `#5`
- SITE-003 Base and latest published `main` at task start: `6261a8a5f594102e898f77c7d0e05d58218298d7`

The SITE-002 Session Provider, authentication Header, typed error boundary, and
Platform runtime configuration remain the shared foundation. Public Catalog reads
are independent from Session loading and authentication state.

## Platform artifacts

- Storefront Client: `@oripa/storefront-client` `2.0.0-alpha.1`
- Storefront Testkit: `@oripa/storefront-testkit` `2.0.0-alpha.1`
- Site Schema: `@oripa/site-schema` `2.0.0-alpha.1`
- Source Commit: `76d8161de759d8969e74543f6d79b5f5b17cee1d`
- Artifact authority: `vendor/oripa/MIG-061U/artifact-manifest.json`
- Public OpenAPI SHA-256: `71e8b5ab885a1e04fa64ecff0b4365be6552424e2dd625a8ddadbf60f66e6005`

## Available contracts

- Browser Session, registration, password login, logout, and email verification
- Public gacha list with cursor, category, and tag query support
- Public gacha categories and tags
- Public banners
- Public notice summaries
- Public gacha detail exists in the Client but remains outside SITE-003 implementation scope

## Preview constraint

Preview Public Route, exact Origin, HTTPS, same-Origin proxy, cookie/CSRF
pass-through, and asset delivery are not configured by this Repository. SITE-003
uses Testkit only and does not claim live Preview connectivity.

## Pending contracts

- Point balance
- Point history
- Point products and purchase eligibility
- Point purchase
- Current user's gacha history list
- Preview Public Route, Origin, and same-Origin proxy
- Explicit catalog display status, optional ordering, and featured placement

## Next task

SITE-004 should implement only its explicitly approved route and should reuse the
Public Catalog adapter, asset fallback, cards, Session Provider, and typed Platform
error presentation. Gacha execution, point purchase, and inferred sales decisions
remain prohibited without a dedicated contract-aware Task.

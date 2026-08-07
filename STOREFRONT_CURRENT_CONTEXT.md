# Storefront current context

## Repository state

- SITE-001 Storefront foundation and common layout: completed
- SITE-002 Authentication client integration and session foundation: completed
- SITE-003 Public home and gacha catalog: completed
- SITE-004 Gacha detail and draw eligibility: resumed on Issue `#9`; MIG-061Y contract-backed implementation completed by this change
- SITE-009 Notices and static pages: completed
- SITE-007 Prize inventory and selection UI: held on its separate Platform Contract
- Resumed SITE-004 base and latest published `main`: `093e662d03da61ba2d5955ab00c87056eb80b5b8`

The SITE-002 Session Provider, authentication Header, typed error boundary, and
Platform runtime configuration remain the shared foundation. Public Catalog reads
are independent from Session loading and authentication state.

## Design reference

The canonical design reference is <https://oripaone.jp/>. Storefront screen
composition, layout, and responsive behavior should prioritize delivery speed and
reproduction accuracy while strongly referencing its general UI structure,
spacing, navigation, card composition, and short UI labels. Components must keep
assets replaceable with Luxe Pack-specific materials.

## Platform artifacts

- Storefront Client: `@oripa/storefront-client` `2.0.0-alpha.2`
- Storefront Testkit: `@oripa/storefront-testkit` `2.0.0-alpha.2`
- Site Schema package: `@oripa/site-schema` `2.0.0-alpha.2`
- Source Commit: `12610e1fefa9c4a6cb555fdd933253bbe54dd0e4`
- Artifact authority: `vendor/oripa/MIG-061Y/artifact-manifest.json`
- Public OpenAPI SHA-256: `ea95cd45465c9ec37824dab529c433ed8cfa7f1ba97b89d623f25b457f1952dc`

## Available contracts

- Browser Session, registration, password login, logout, and email verification
- Public gacha list with cursor, category, and tag query support
- Public gacha categories and tags
- Public banners
- Public notice summaries
- Public notice list with cursor continuation and public notice detail
- Public static pages by slug with sanitized canonical HTML presentation
- Public gacha detail by slug
- User-specific gacha presentation through `getGachaPresentation`: sale state,
  audience, eligibility, ineligible reason, allowed draw counts, daily limit, and CTA state

## Preview constraint

MIG-061Z resolves the Platform Public Origin at <https://test.luxe-pack.biz> and
the same-Origin `/api/v2/` proxy, including HTTPS, Cookie/header forwarding, and
cache-header forwarding. The Storefront application itself is not deployed at
that Origin and `/` currently returns HTTP 404, so full browser same-Origin E2E
has not been performed.

## Pending contracts

- Point balance
- Point history
- Point products and purchase eligibility
- Point purchase
- Current user's gacha history list
- Explicit catalog display status, optional ordering, and featured placement
- Point-insufficient presentation at gacha-detail time
- SITE-007 prize inventory read/action contract
- Storefront Preview application deployment and end-to-end asset reachability

## Next task

SITE-005 can reuse SITE-004's selected-count and canonical CTA boundary for the
Draw mutation. It must let the Backend mutation decide Point insufficiency and
must not derive it from any Frontend balance. SITE-007 remains separately held.

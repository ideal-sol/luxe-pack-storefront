# Storefront current context

## Repository state

- SITE-001 Storefront foundation and common layout: completed
- SITE-002 Authentication client integration and session foundation: completed
- SITE-003 Public home and gacha catalog: completed
- SITE-004 Gacha detail and draw eligibility: completed
- SITE-009 Notices and static pages: completed
- SITE-007 Prize inventory and selection UI: completed
- SITE-010 Visual and responsive convergence: completed
- SITE-006 My page top and member navigation: completed by this change
- SITE-006 Base and latest published `main` at Task start: `849effc27dae6f6f8576ffb2337646bfa798e4c5`

The SITE-002 Session Provider, authentication Header, typed error boundary, and
Platform runtime configuration remain the shared foundation. Public Catalog reads
are independent from Session loading and authentication state.

## Design reference

The canonical design reference is <https://oripaone.jp/>. Storefront screen
composition, layout, and responsive behavior should prioritize delivery speed and
reproduction accuracy while strongly referencing its general UI structure,
spacing, navigation, card composition, and short UI labels. Components must keep
assets replaceable with Luxe Pack-specific materials.

SITE-010 converges the implemented routes on an approximately 800-pixel desktop
reading width, 12–16-pixel mobile edge rhythm, 52/60-pixel mobile/desktop Header,
single-column mobile and two-column desktop gacha grids, and shared card, control,
focus, safe-area, and sticky-action treatment. This is presentation-only; no
Platform response or Frontend business decision changed.

## Platform artifacts

- Storefront Client: `@oripa/storefront-client` `2.0.0-alpha.4`
- Storefront Testkit: `@oripa/storefront-testkit` `2.0.0-alpha.4`
- Site Schema package: `@oripa/site-schema` `2.0.0-alpha.4`
- Source Commit: `a3f8aeb3af5dc7a22f533c2e920e2b1a0c450f33`
- Artifact authority: `vendor/oripa/MIG-062A/artifact-manifest.json`
- Public OpenAPI SHA-256: `d9512a3bce378172b8ee330ed29f56a71a2b478329fdcf469e58909523ee7e08`

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
- Current-user Prize collection/detail through `listPrizes` and `getPrize`, with
  typed presentation, cursor continuation, and Backend-authoritative shipping,
  point-exchange, and selection action states
- Authenticated My Page top through the existing browser Session fields and
  centralized member/support Route definitions; no Profile enrichment contract
  is assumed

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
- Prize inventory canonical status grouping/filter contract
- Prize expiry lifecycle, grace-period, and automatic-conversion semantics
- Storefront Preview application deployment and end-to-end asset reachability

## Next task

SITE-005 remains independently held on its Platform Draw mutation boundary and
is unchanged by SITE-006. When resumed, it can reuse SITE-004's selected-count
and canonical CTA boundary, but must let the Backend mutation decide Point
insufficiency. Later Prize mutation Tasks can reuse SITE-007 selection, but must
revalidate actions in Backend and resolve group mutation, address, and
stale-selection behavior.

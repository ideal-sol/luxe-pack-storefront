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
- SITE-011 LINE account link UI: implemented by this change
- SITE-005 Gacha draw execution and result: implemented by this change
- SITE-005 Original Base: `9b5eb72d545c95a6cfa3462f500cb4bdeb9fd76c`
- SITE-005 Resumed Base and latest published `main` at resume: `e6e30eaa37aacb7df98663ecc70eb6422989b9d5`

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

- Storefront Client: `@oripa/storefront-client` `2.0.0-alpha.6`
- Storefront Testkit: `@oripa/storefront-testkit` `2.0.0-alpha.6`
- Site Schema package: `@oripa/site-schema` `2.0.0-alpha.6`
- Source Commit: `fedc176f06518edcf9dd57c0387a6d03eee7471b`
- Artifact authority: `vendor/oripa/MIG-062C/artifact-manifest.json`
- Public OpenAPI SHA-256: `6f4fc425718a57237fa89c0f6c75b196c0bf287022ce117dd916dd9b2cf457a1`

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
- Current external identities and LINE link transaction start through
  `listExternalIdentities` and `startLineIdentityLink`; authorization URL,
  callback validation, and return path remain owned by the generated identity contract
- Browser-safe Draw mutation through `createBrowserStorefrontDrawClient`,
  caller-owned canonical Idempotency Keys, generated `DrawProblemCode`, and
  completed-result recovery through `getDrawRequest`

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
- Point-insufficient presentation at gacha-detail time (Draw execution uses the
  canonical Backend typed error and does not depend on this presentation)
- Prize inventory canonical status grouping/filter contract
- Prize expiry lifecycle, grace-period, and automatic-conversion semantics
- LINE Official Account friend/addition state
- LINE unlink UI orchestration after recent reauthentication
- Storefront Preview application deployment and end-to-end asset reachability

## Next task

SITE-005 is complete. Later Prize mutation Tasks can reuse SITE-007 selection, but must
revalidate actions in Backend and resolve group mutation, address, and
stale-selection behavior. A later identity Task may add LINE unlink only after
the post-reauthentication continuation is canonical; friend state also remains a
Platform presentation contract.

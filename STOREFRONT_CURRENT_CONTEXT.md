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
- SITE-013 Storefront Preview deployment: implemented by this change
- SITE-012 Prize shipping and point exchange: implemented by this change
- SITE-016 Preview public data diagnosis: completed by this change
- SITE-017 Preview Browser runtime diagnosis: completed by this change
- SITE-018 Authenticated My Page route Session continuity: completed by this change
- SITE-019 Prize Inventory Preview Read diagnosis: completed by this change
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

- Storefront Client: `@oripa/storefront-client` `2.0.0-alpha.8`
- Storefront Testkit: `@oripa/storefront-testkit` `2.0.0-alpha.8`
- Site Schema package: `@oripa/site-schema` `2.0.0-alpha.8`
- Source Commit: `5c9053ca2434847032a51f8b4f09dd25c8ef8535`
- Artifact authority: `vendor/oripa/MIG-062E/artifact-manifest.json`
- Public OpenAPI SHA-256: `210692ca1fa89c7ae28fc942c07d2b740eac7e2230d6b8c255570ac6bc16d568`

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
- Browser-safe Prize fulfillment through
  `createBrowserStorefrontPrizeShippingClient`: address read/create/update/delete,
  point exchange, and shipping request creation/read. Generated fulfillment
  problems and mutation retry semantics remain the authority; successful
  mutations reconcile Prize, Shipping, and Address reads.

## Preview deployment

MIG-061Z resolves the Platform Public Origin at <https://test.luxe-pack.biz> and
the same-Origin `/api/v2/` proxy, including HTTPS, Cookie/header forwarding, and
cache-header forwarding. SITE-013 adds a Preview-only production Next.js service
on `127.0.0.1:3200` and connects only the virtual host's `/` location to it. The
existing Platform proxy, Admin API 404 boundary, TLS configuration, production
Storefront, and V1 remain unchanged.

The deployed build uses `NEXT_PUBLIC_PLATFORM_API_BASE_URL=/api/v2`, so Browser
requests remain same-Origin. State-changing authenticated Preview journeys are
not exercised by deployment smoke.

SITE-015 refreshes the Preview application release to SITE-012 Squash Commit
`980985099fe5a1612b9da5a61b73b371a9b7b864`. The Nginx `/api/v2` proxy,
`/admin/api/` boundary, TLS, Preview service definition, listen port, production
Storefront, V1, and Platform remain unchanged. Shipping, point-exchange, and
address UI are present in the build, but deployment smoke performs no
state-changing fulfillment operation.

SITE-016 verifies public reads through the runtime-equivalent relative `/api/v2`
base and pinned alpha.8 Client. Catalog data is available and Client-accepted;
banners and notices are valid empty collections. The canonical `terms` static
page is not published and returns Platform Problem Details with HTTP 404. No
Storefront Client, adapter, presentation, or runtime configuration defect was
reproduced. The repeatable, response-body-free diagnosis is documented in
`docs/operations/preview-public-data-diagnosis.md`.

SITE-017 reproduces the Browser-only failure in Chromium. The generated Client's
stored native `window.fetch` was invoked with a non-Window receiver and Chrome
rejected it with `Illegal invocation` before any Public API request. The shared
Storefront Browser transport now supplies a receiver-safe fetch function. No API
path, runtime configuration, response contract, or presentation rule changed.

SITE-018 confirms that the Platform Session, Cookie, root Session Provider, and
client-side navigation remain authenticated across My Page routes. The defect
was limited to pending-contract placeholder pages that rendered Login Required
unconditionally. Those pages now distinguish Session loading, authenticated,
unauthenticated／expired, and configuration／transport error states. Pending Point
and Draw-history data remains unimplemented and is shown only as the existing
neutral empty state for authenticated users.

SITE-019 reproduces the Prize Inventory failure in a real Browser and confirms
that the Platform returns HTTP 200 data accepted by the canonical Client once the
native fetch receiver is preserved. The Prize-specific Browser Client factory now
uses the same receiver-safe fetch boundary as the shared Browser transport. No
Prize response, action rule, fixture, mutation, or Platform behavior changed.

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
- Storefront responsive Browser review and authenticated state-changing Preview journeys
- Canonical Preview static content for `terms` (and any other required Footer slugs)

## Next task

Platform content operations should publish the required canonical static pages
before a content-complete Preview review. A later task may add canonical Prize
status grouping and expiry lifecycle presentation; identity work must retain the
canonical post-reauthentication and friend-state boundaries.

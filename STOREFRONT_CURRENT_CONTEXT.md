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
- SITE-014 Gacha Catalog display contract alignment: completed by this change
- SITE-020 Gacha Detail visual QA fix: implemented by this change
- SITE-021 100／1000 Draw availability: implemented by this change
- SITE-022 Footer page navigation: implemented by this change
- SITE-025 Home top banner carousel: implemented by this change
- SITE-026 Point purchase page layout: completed
- SITE-027 Point Read Integration: implemented by this change; purchase and Payment remain pending
- SITE-028 Current User Gacha History Integration: implemented by this change
- SITE-029 LINE Friend State Integration: implemented by this change
- SITE-030 Coin Display / Expiring Balance Integration: implemented by this change
- SITE-031 Coin Terminology Completion — Prize UI: implemented by this change
- SITE-036 Shipping Address Management Page: implemented by this change
- SITE-037 Authenticated Contact and Support Link: implemented by this change
- SITE-038 Coin Purchase Detail Page: implemented by this change
- SITE-040 Payment Purchase Flow: implemented by this change; purchase history,
  Provider Browser E2E, and deployment remain out of scope
- SITE-041 Purchase History / Unpaid History: implemented by this change;
  receipt, Provider Browser E2E, and deployment remain out of scope
- SITE-042 Wallet Sync / Storefront UI Hygiene: implemented by this change;
  Provider Browser E2E and deployment remain out of scope
- SITE-043 Payment Client alpha.29 Adoption / Card UI Fix: implemented by this
  change; deployment and Provider Browser E2E remain out of scope
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

- Storefront Client: `@oripa/storefront-client` `2.0.0-alpha.29`
- Storefront Testkit: `@oripa/storefront-testkit` `2.0.0-alpha.29`
- Site Schema package: `@oripa/site-schema` `2.0.0-alpha.23`
- Source Commit: `5cde1e0a91151b584de8a63d19efd7b4a15e8ab1`
- Artifact authority: `vendor/oripa/MIG-094/artifact-manifest.json`
- Public OpenAPI version: `2.0.0-alpha.27`
- Public OpenAPI SHA-256: `41ebdddbd7c4edeedd36ad3810b2afa564495aa2d1c3e48a187f44c85deb85da`

## Available contracts

- Browser Session, registration, password login, logout, and email verification
- Public gacha list with Backend-stable cursor ordering, category/tag queries,
  mixed sale states, anonymous/authenticated eligibility, reason, CTA, and
  display-fact policy
- Public gacha categories and tags
- Backend-filtered top Banner navigation through `listBanners`, preserving
  canonical title, public image URL, safe link URL, and returned order
- Public notice summaries
- Public notice list with cursor continuation and public notice detail
- Public static pages by slug with sanitized canonical HTML presentation
- Backend-filtered Footer Page navigation through `listFooterPages`, preserving
  returned title, slug, and order; successful empty collections are supported
- Browser-safe anonymous／authenticated Contact submission with Client-owned
  CSRF／Cookie orchestration, canonical `202` receipt, typed validation and
  rate-limit errors, and no automatic mutation retry
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
- Current-user LINE Friend State through generated `getLineFriendState`, preserving
  Backend status, LINE-user decision, and primary action presentation without
  deriving eligibility or action state from Identity/Friendship flags
- Browser-safe Draw mutation through `createBrowserStorefrontDrawClient`,
  caller-owned canonical Idempotency Keys, generated `DrawProblemCode`, and
  completed-result recovery through `getDrawRequest`
- Browser-safe Prize fulfillment through
  `createBrowserStorefrontPrizeShippingClient`: address read/create/update/delete,
  point exchange, and shipping request creation/read. Generated fulfillment
  problems and mutation retry semantics remain the authority; successful
  mutations reconcile Prize, Shipping, and Address reads.
- Current-user Point wallet balance through generated `getWallet`; all balance
  surfaces share its canonical total, `/points` and `/mypage/points` render each
  Backend expiry bucket, and no surface totals Ledger entries or derives expiry
- Point products through generated `listPointProducts`, preserving Backend
  ordering, audience, sale, eligibility, reason, and CTA presentation
- Current-user Point history through generated `listPointLedgerEntries`,
  preserving signed deltas, occurred times, Backend reason labels, and opaque
  cursor continuation
- Current-user Gacha history through generated `listDrawHistory`, preserving
  Historical Gacha title／presentation image, occurred time, requested／executed
  counts, Backend status／label, stable returned order, and opaque cursor
  continuation
- Authenticated Payment purchase through the Browser-safe canonical Payment
  Client: Payment start/read/unpaid-resume, Card UI bootstrap, saved-card
  list/delete, and registration intent. New Card input is owned by the official
  fincode UI Component; the Storefront does not read PAN/CVC or complete Card
  registration directly.
- Current-user Payment history through generated `listPayments`, preserving the
  canonical `succeeded`／`unpaid` views, returned order, opaque cursor, amount,
  method, status, and persisted Payment Grant snapshot. Payment detail uses
  `getPayment`, and unpaid guidance resumes the existing Payment only through
  `resumeUnpaidPayment` without a replacement Payment or Provider session.
- Browser-safe unpaid resume uses the MIG-094 alpha.29 canonical JSON POST
  request. Konbini and Virtual Account retain Purchase → Thanks → guide → resume,
  and the Storefront adds no raw request or 415 workaround.
- New Card UI loads the official environment-specific fincode Browser script
  before calling canonical `initFincode()`, then distinguishes secret-safe
  SDK-load, initialization, UI-create, and UI-mount failures. Purchase remains
  disabled until `ui.mount()` succeeds.

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

SITE-014 resumes on MIG-062G alpha.9. Catalog items now carry the same canonical
sale/eligibility decision family as Detail/Draw plus explicit display flags.
Home and `/gachas` retain Backend-returned ended, sold-out, and ineligible items
in order; cards never derive state from dates, counts, audience, or Session.

SITE-020 keeps variable-length Gacha Detail rank labels inside responsive pill
badges and adds Detail-only Footer clearance for the fixed Draw tray. Mobile
clearance includes the existing Bottom Navigation and safe-area stack. This is
presentation-only and does not alter Draw options, sale state, eligibility, or
any Platform Contract.

SITE-021 adopts MIG-062J alpha.10. Gacha Detail renders Backend-configured
requested counts, including optional 100／1000, without filtering against
remaining units. Draw submits the selected requested count unchanged, while
result and reload recovery use canonical executed count independently. The
partial-remaining Testkit fixture covers requested 1000, executed 900, sold-out,
and same-key replay without Frontend Draw or Point calculation.

SITE-022 adopts MIG-062O alpha.11. Footer `INFORMATION` navigation now consumes
the anonymous `listFooterPages` read. Membership, publication state, order,
title, and slug remain Backend-owned. The Storefront renders no invented links
for an empty response and contains read failures within the Information region.

SITE-025 adopts MIG-062P alpha.14. Home top Banners now consume the canonical
`listBanners` collection. One item renders without redundant controls, multiple
items use a native scroll-snap carousel with explicit controls, and an empty
collection retains the neutral existing state. The Storefront does not filter,
sort, rebuild asset paths, or reinterpret returned link URLs. Banner read errors
are contained within the Banner section so other public Home data can remain
available.

SITE-026 replaces the public `/points` placeholder with a responsive Point
purchase layout. The balance boundary intentionally displays `--`; the two
human-approved presentation categories are interactive UI state only; and the
product region renders a neutral preparing state. Runtime code contains no
product fixture, eligibility decision, purchase CTA, Platform request, Payment
connection, or optimistic Point behavior. Balance, product, eligibility, and
purchase contracts remain pending for a later integration task.

SITE-027 adopts the verified immutable MIG-062U alpha.18 Artifact and retains
MIG-062R's Point Product Read／Eligibility contract. Header, `/points`, and
`/mypage/points` share the generated current-user Wallet read. `/points` renders
the canonical product collection and Backend presentation without deriving
first-purchase or eligibility state. `/mypage/points` appends canonical history
pages in returned order with the opaque cursor unchanged. Purchase-capable CTA
presentation is visible but disabled; no Point purchase or Payment mutation is
connected.

SITE-028 adopts the verified immutable MIG-062V alpha.19 Artifact after checking
Manifest／`SHA256SUMS`／formal files and confirming that alpha.19 retains the
alpha.18 Point contract. `/mypage/draws` renders only MIG-062V Historical Gacha
presentation and Backend facts in returned order. Cursor continuation is passed
through unchanged. No Draw status, Gacha lifecycle, partial execution, ordering,
or historical presentation rule is implemented in the Frontend.

SITE-029 adopts the verified immutable MIG-062W alpha.20 Artifact and confirms
that its Public OpenAPI change is additive to alpha.19. `/mypage/line` preserves
the existing LINE Identity display and link-start transaction while rendering
the canonical Friend State status and action presentation. `is_line_user` is
never recomputed; unknown actions, unsafe external schemes, and cross-contract
inconsistency produce no fallback action. No unlink, friend mutation, Provider,
OAuth callback, Platform, Payment, or infrastructure change is included.

SITE-030 adopts the verified immutable MIG-062Z alpha.21 Artifact after confirming
that alpha.20's Auth／Session／Catalog／Content／Gacha／Draw／Prize／Point Product／
Point History／LINE contracts remain present. Header and shared balance surfaces
use canonical `total_points`; the two Point pages render the returned
`expiring_within_7_days` array without expiry decisions and format `expires_at`
in JST. User-facing currency words are presented as Coin, including Backend
Product titles and History reason labels, while canonical response objects and
technical Point identifiers remain unchanged. Paid/bonus product breakdown is
not displayed, and no mutation is connected.

SITE-031 completes the approved user-facing Coin terminology migration in Prize
inventory and fulfillment while retaining MIG-062Z alpha.21 unchanged. Fixed
status, reason, value, action, confirmation, success, and typed-error text use
Coin terminology. A presentation-only helper derives display text for Backend
Prize names without mutating the canonical response. Prize allowed actions,
exchange values, statuses, lifecycle, expiry, and mutation behavior remain
unchanged and Backend-authoritative.

SITE-034 adopts the verified immutable STORE-SITE-034 package-only Artifact.
Only the Storefront Client and Testkit advance to alpha.24; Site Schema and
Public OpenAPI remain the referenced alpha.23 assets. `/contact` delegates the
anonymous and authenticated first-submit Browser ceremony to
`createBrowserStorefrontContentContactClient()`, maps the canonical Contact body
with an undisplayed empty `website`, and displays the returned `receipt_code`.
The Storefront does not own CSRF／Cookie protocol, Idempotency, or retry behavior.

SITE-035 adds the public `/verify-email/error` destination for a later Platform
Browser 303 failure redirect. Presentation reads only the canonical query
`code`; `EMAIL_ALREADY_CLAIMED` has its approved message and every other value,
including missing or repeated `code`, falls back to the generic message. Raw
Problem Details and unrelated query fields are never rendered. The page adds no
API request, Session requirement, verification-token handling, or Register／
successful `/mypage` redirect change.

SITE-036 reuses SITE-012's existing Browser-safe Prize Shipping Client and
generated `ShippingAddressInput` on the login-required `/mypage/address` route.
The My Page Account section places `お届け先登録` immediately above `LINE連携`.
The page lists only Platform-returned masked presentations and supports canonical
list/detail/create/update/delete behavior with the existing in-memory create
Idempotency Key and update/delete reconciliation rules. Prize Shipping retains
registered-address selection and its existing shipping mutation; it removes the
new-address CTA and, only when `listShippingAddresses` returns an empty
collection, blocks shipping and links normally to `/mypage/address`. The pinned
Artifact, Platform Contract, Prize eligibility, Point/Coin Exchange, and
successful canonical refetch behavior remain unchanged.

SITE-037 makes `/contact` authenticated-only at the Storefront UI boundary.
The route waits for the existing root Session Provider, mounts no Contact form
while Session is loading, and uses the established Next client navigation to
replace a confirmed unauthenticated／expired Session with exact `/login`. It
adds no Return URL query, Cookie inspection, independent Auth decision, or
Platform call. Authenticated Contact submission retains the pinned Browser-safe
Client and its canonical receipt／typed-error／no-retry behavior. My Page keeps
the established support order while changing `お問い合わせ` to exact
`https://support.luxe-pack.biz/` with the existing external-link treatment.
SITE-036 address navigation and Prize Shipping behavior remain unchanged.

SITE-038 adds display-only `/points/purchase/[productId]` using the retained
generated `listPointProducts` collection. The Contract Gate confirms `id` is a
public opaque identifier and that canonical title, JPY price, total grant,
audience, sale／availability／eligibility／reason／CTA, and Limited Bonus
Presentation are sufficient. `/points` percent-encodes that exact `id` in an
independent `詳細を見る` Link while preserving the existing Backend CTA. The
detail exact-matches the successful collection, renders no invented Product on
unknown IDs or read errors, and contains no Purchase／Payment button or call.
Platform／Artifact／Runtime／Payment remain unchanged.

SITE-040 adopts the immutable MIG-089 alpha.28 Client／Testkit and referenced
Public OpenAPI alpha.27. The existing exact `PointProduct.id` boundary now shows
the canonical paid, normal bonus, active limited bonus, and computed total rows,
then starts Credit Card／PayPay／Konbini／Virtual Account payments only through the
Browser-safe Payment Client with one caller Idempotency Key. Saved Card order,
eligibility, and three-card limit remain Platform-owned. New Card input uses
`getPaymentCardUiBootstrap()` followed by official fincode `initFincode()` and UI
mount; mount success is required before purchase, and application code never
calls `getFormData()` or handles raw PAN/CVC.

`/points/purchase/thanks?pid=...` always reads the canonical Payment. Card and
PayPay poll every two seconds for at most 30 seconds, honoring 429 retry hints;
Konbini and Virtual Account reuse the same Payment through
`resumeUnpaidPayment()`. Success, failure, cancel, expired, delayed, and contained
invalid/unauthorized states follow the approved copy. Purchase history routes,
receipts, Provider Browser E2E, Platform Runtime changes, and deployment remain
unimplemented or on hold.

SITE-042 keeps the existing Wallet Client and Session boundary as the only
Header balance authority. Successful Draw, Prize Coin Exchange, and canonical
Payment `succeeded` confirmation trigger a fresh `getWallet()` read; visible
pages also refresh every 60 seconds, hidden pages stop polling, and foreground
focus／visibility refreshes are coalesced. Existing valid balance presentation
survives a temporary background read failure. No mutation amount is added to or
subtracted from the Header in the Frontend.

The `/points` cards omit the three approved redundant purchase labels without
leaving an empty CTA region, while canonical Product facts, detail links, sale／
audience／eligibility state, and ineligible reasons remain visible. The approved
Gacha, Wallet, Product, History, and LINE technical copy is removed or replaced;
LINE status code／Identity rows and its technical footer are no longer rendered.
The immutable MIG-089 alpha.28 Artifact and all Platform business presentation
remain unchanged. Application-only Deployment is NOT RUN and Provider Browser
E2E remains HOLD.

SITE-043 adopts immutable MIG-094 alpha.29 as a new vendor directory while
retaining MIG-089 byte-for-byte. The package-only release changes only the
canonical Payment resume request to carry an empty JSON body; Public OpenAPI
alpha.27 and Site Schema alpha.23 remain unchanged. Konbini and Virtual Account
continue through Purchase → Thanks Page → unpaid guide → existing redirect
resume, with no replacement Payment or Provider session.

The Card UI failure was in the pinned `@fincode/js@1.1.0` Browser loader: its
existing-script selector rejects before it can inject the official fincode
resource. The Storefront now loads only the official test/live script URL first,
then calls `initFincode()`, `ui.create("payments")`, and `ui.mount()`. Failures are
classified internally as SDK load, init, create, or mount without retaining or
logging credentials, PAN, CVC, raw Provider responses, Cookie, Session, or
tokens. No `getFormData()`, undocumented event, CSP, Nginx, runtime, Platform,
or Provider configuration change is included.

## Pending contracts

- Payment receipt contract/UI
- Optional featured placement beyond the Backend-stable Catalog order
- Point-insufficient presentation at gacha-detail time (Draw execution uses the
  canonical Backend typed error and does not depend on this presentation)
- Prize inventory canonical status grouping/filter contract
- Prize expiry lifecycle, grace-period, and automatic-conversion semantics
- LINE unlink UI orchestration after recent reauthentication
- Storefront responsive Browser review and authenticated state-changing Preview journeys
- Canonical Preview static content for `terms` (and any other required Footer slugs)

## Next task

Platform content operations should publish the required canonical static pages
before a content-complete Preview review.
A later task may add canonical Prize status grouping and expiry lifecycle
presentation; identity work must retain the canonical post-reauthentication
boundary.

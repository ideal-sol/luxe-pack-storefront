# Frontend architecture

## Layers

1. `src/app` owns App Router composition, route-level loading, and error boundaries.
2. `src/components/layout` owns responsive shell components.
3. `src/components/common` owns presentation-only reusable UI.
4. `src/lib/routes` is the single navigation definition.
5. `src/lib/platform` owns runtime configuration and the narrow canonical Client adapter.
6. `src/components/auth` owns session orchestration and authentication presentation.
7. `src/components/catalog` owns public catalog orchestration and contract-backed presentation.
8. `src/components/content` owns public notices, static documents, and the single sanitized HTML boundary.
9. `src/components/prizes` owns authenticated inventory orchestration, Backend-authoritative selection presentation, and Browser-safe fulfillment journeys.
10. `src/components/draw` owns confirmation, transient Idempotency operation state, typed Draw-error presentation, and GET-only result recovery.
11. `src/components/payment` owns Provider-approved Card UI, opaque Return correlation, typed Payment／Card Registration presentation, and no business-rule authority.

## Preview runtime

The merged Preview build runs as a production Next.js process bound only to
`127.0.0.1:3200` and managed by a Preview-specific systemd unit. Nginx terminates
TLS for `test.luxe-pack.biz`, preserves the existing `/api/v2` Platform proxy and
`/admin/api/` 404 boundary, and proxies only Storefront routes to Next.js.

The browser Platform base is `/api/v2`; Components and adapters do not know the
Platform upstream. Release directories are created from a reviewed Git commit,
and a `current` symlink identifies the exact deployed Squash Commit. Operational
details, Backup, verification, and rollback are defined in
`docs/operations/preview-deployment.md`.

## Server and Client Components

Pages, Footer, containers, titles, and static state panels are Server Components by default. Session Provider, Header authentication state, forms, Mobile active-route navigation, Toast state, Confirmation Dialog interaction, and the root error boundary are explicit Client Components with `"use client"`.

The root Session Provider constructs the browser adapter, performs the initial
session read, distinguishes loading/authenticated/unauthenticated/configuration
unavailable/session expired/error states, and refreshes after successful identity
mutations. It stores the typed session response only in memory and does not cache
credentials or authentication material.

SITE-050 extends that adapter with the Account Security operations now retained by
the exact-pinned alpha.34 Client.
Password Reset request／completion never refreshes into an authenticated Session.
Email Address Change refreshes only when the canonical completion result says the
current browser is authenticated; cross-browser completion explicitly remains
anonymous. Password Change refreshes the canonical Session after the immediate
mutation so rotated Session／CSRF state replaces stale client state. Shared password
fields own only visibility, confirmation, loading, and presentation validation;
Platform remains the Password Policy and credential authority.

Platform-generated Password Reset and Email Change links land on `/` with query
parameters. `src/proxy.ts` runs only for that landing path and redirects before
React rendering to a dedicated route with a browser-only fragment, `no-store`,
and `no-referrer`. The dedicated Client Component validates the public input
shape, consumes it once across React Strict Mode, and immediately removes the
fragment without copying App Router history state. Tokens are not passed through
Server Component props, DOM bootstrap data, Browser storage, analytics, or
Account Security application logging.

Authenticated routes consume that same root Session state. They
render Loading while the initial read is pending, Login Required only for an
explicit unauthenticated／expired state, a neutral pending-content state for an
authenticated member, and a separate Error state for configuration／transport
failure. Draw history remains a pending-contract neutral state.

The root Point Client Provider is nested under Session Provider and owns one
canonical current-user Wallet read per authenticated Session. Header, `/points`,
and `/mypage/points` consume the same in-memory Wallet state, so the Frontend
never totals Ledger entries. Its adapter exposes only generated `getWallet`,
`listPointLedgerEntries`, and `listPointProducts` reads.

`/points/purchase/[productId]` reuses `listPointProducts` as its only Product
authority. The route helper percent-encodes the canonical public opaque `id` as
one path segment, and the Client Component resolves it only by exact equality
against the successful collection response. A successful collection without a
match is Not Found; a failed read remains Error. The detail renders returned
price/currency, `grant.total_points`, audience, sale/eligibility presentation,
and the established SITE-032 Limited Bonus presentation without calculation.
The Purchase form delegates every Payment and Card Registration request to the
narrow generated Payment Client adapter.

SITE-048 replaces the legacy non-3DS Save Card path with MIG-098 alpha.31.
New Card input remains inside the fincode UI and is tokenized only for the typed
`startCardRegistration` request. A Platform `requires_action` URL performs
Registration 3DS. The root Return dispatcher correlates only a Public Opaque
Registration ID with tab-local product and Idempotency identifiers; it stores no
Card input or Provider identifier. The Purchase route performs a canonical read
and at most one typed reconcile. Only `completed` with `saved_card_id` can start
a separate `source=saved` Payment, whose 3DS action is independently required.
`registration_remaining` controls save availability; `cards.length` is retained
only for the Human-specified three-card input visibility rule.

The root Public Client Provider constructs a separate read adapter from the same
browser transport configuration. It does not depend on Session state. Home and
catalog Client Components start public requests independently, while endpoint
paths, query encoding, response types, retry behavior, and transport metadata
remain owned by the canonical Client.

SITE-009 extends the same adapter with `listNotices`, `getNotice`, and
`getStaticPage`. Notice and static-page Components never construct endpoint paths
or response types. Canonical `body_html` passes through `safe-content.tsx`, which
uses an explicit element, attribute, and URL-scheme allowlist before the sole
`dangerouslySetInnerHTML` boundary. External HTTPS links receive a new browsing
context with `noopener noreferrer`; scriptable schemes and event attributes are
discarded.

SITE-004 extends the Catalog adapter with the generated `getGachaBySlug` and
`getGachaPresentation` methods. The detail Component first resolves canonical
content, then passes the returned gacha ID to the user-specific presentation
read. Sale state, eligibility, reason, allowed counts, daily limit, and CTA state
are rendered directly from that presentation. Session state, timestamps, counts,
and Point balance are never converted into eligibility or CTA policy.

SITE-051 consumes the alpha.34 `GachaRankPresentation` collection exactly as
returned. The detail sorts the returned Prize-associated Ranks by canonical
`display_order` with `rank_id` only as a stable tie-breaker, renders
`rank_name` and `lineup_image`, and displays only non-null `total_stock` when
`show_total_stock` is true. It does not reconstruct Rank Master membership,
classify Prizes, calculate stock, play `current_video`, or retain a legacy
`RankDisplay` adapter.

SITE-007 adds a separate authenticated Prize adapter limited to generated
`listPrizes` and `getPrize` reads. Cards use `presentation`; deprecated open
snapshots are ignored. Selection reads only `allowed_actions.selection.allowed`,
and the bulk tray is the intersection of Backend-returned shipping and point
exchange actions for selected items. Status, deadline, and exchange value are
display facts and never inputs to an action decision. No Prize mutation is
exposed by the adapter.

SITE-005 adds a separate generated Browser Draw adapter. The canonical Client
owns CSRF initialization, Cookie reading, protocol headers, request/response
types, and bounded transport retry. The Component creates one canonical
Idempotency Key per user operation, retains it only in memory for a retry of that
same operation, and discards it when a final rejection or new count selection
defines a new operation. The result route receives only the returned public Draw
Request ID and calls `getDrawRequest`; mounting, Back, and reload never call the
mutation. Point, eligibility, sale, inventory, and awarded Prize state are never
updated optimistically.

SITE-051 presents individual or high-Rank Draw results from the persisted
`rank_name_snapshot`, `result_image_snapshot`, and `video_snapshot`. Snapshot
array ordering is preserved. Video is user-controlled, inline-capable, and a
playback failure removes only the video while the snapshot image, name, and Draw
facts remain visible. The result route never fetches current Rank Master or
Gacha Rank video state and never falls back to detail `lineup_image`.

SITE-012 extends the Prize boundary with the generated
`createBrowserStorefrontPrizeShippingClient`. The Client owns Cookie/CSRF
protocol details. Point exchange, address creation, and shipping request creation
use one caller-owned in-memory Idempotency Key per operation and retain that key
for a same-operation retry. Address update/delete are never automatically
retried: an uncertain transport result is reconciled through
`getShippingAddress` or `listShippingAddresses` before any next action. Every
successful mutation is followed by canonical Prize, Shipping, and Address reads;
the UI does not optimistically change Prize state or Point balance.

SITE-036 exposes the same address boundary on the authenticated
`/mypage/address` route. Shared address fields use only generated
`ShippingAddressInput`; list cards use only the masked collection presentation.
Create retains one in-memory Idempotency Key for a same-operation retry, while
update/delete preserve canonical reconciliation before any retry. The Prize
Shipping dialog no longer creates an address. Its empty state comes only from
`listShippingAddresses` and links to `/mypage/address` without starting a
mutation; non-empty selection and shipping confirmation remain unchanged.

The Prize Browser factory supplies the shared receiver-safe fetch function to the
generated Browser Client. This preserves native Browser invocation semantics while
leaving credentials, Cookie/CSRF handling, paths, decoding, typed problems, and
retry behavior under the canonical Client. Preview Prize reads must reach the
Platform before the UI classifies a successful collection, empty collection, or
typed problem.

## State and data rules

- No direct database or Platform request from a React Component.
- No local recreation of draw, point, inventory, eligibility, or limit rules.
- No fake balance, result, purchase response, or authenticated user.
- Empty values use `--` or an explicit development state.
- Public environment variables are read only by the Platform runtime adapter, never by Components.
- Browser credentials, CSRF setup, cookies, and protocol headers are delegated to the pinned Client.
- Typed requests and responses are aliases of generated Client types; they are not handwritten.
- Catalog cards display returned fields without inferring publication, sales,
  sold-out, eligibility, first-user, LINE-user, or daily-limit state.
- Catalog cards preserve Backend-returned ordering and consume alpha.9
  `presentation` directly. Sale/eligibility/reason/CTA are never reconstructed;
  `display.show_price_points`, `display.show_total_count`, and
  `display.show_drawn_count` alone control those optional facts.
- Cursor continuation uses the returned `meta` object and the Client query type;
  category changes start a new first page.
- Notice continuation uses the returned `next_cursor` unchanged; it is not
  converted into page numbers.
- Notice and static-page availability is determined by the Client response or a
  typed 404 status, never by a Frontend slug registry.
- Remaining/total arithmetic is used only for the visual progress bar. It does
  not determine sale state, inventory availability, or CTA behavior.
- Detail-time Point insufficiency is not published in MIG-061Y. SITE-004 does not
  add a Frontend substitute; SITE-005 uses the generated typed Backend mutation
  rejection and never compares price with a Frontend balance.
- User Prize statuses are shown literally through presentation labels. Because
  MIG-062A publishes no canonical grouping, SITE-007 does not invent status tabs.
- `storage_expires_at` is formatted for display only. The Frontend does not derive
  expiry, selection, shipping, or point-exchange availability from it.

## Testing

Component tests cover the shared shell, session state transitions, forms, duplicate
submission protection, header state, and email verification. Contract tests inject
the deterministic Storefront Testkit into the real browser client. Policy tests
reject direct Platform paths, browser protocol details outside the boundary, and
authentication persistence. SITE-027 adds Point wallet, product, eligibility,
history, cursor, shared-balance, and zero-Payment-mutation coverage with the
alpha.18 Testkit.

SITE-003 adds deterministic Client/Testkit contract tests for banners, notices,
categories, tags, gacha summaries, category queries, and cursor queries. Component
tests cover loading, empty, typed errors, missing configuration, image fallback,
navigation, multiple cards, and independence from authenticated/anonymous Session.

SITE-009 adds Content Client/Testkit contract tests for notice cursor reads,
notice detail, and static-page lookup. Component tests cover list/detail/document
states, links, cursor continuation, route switching, long-form structure, and XSS
removal. SITE-004 adds MIG-061Y Testkit coverage for explicit sale states,
anonymous/authenticated eligibility, allowed counts, daily limits, CTA state,
detail UI, and Backend-authoritative presentation fields. SITE-051 replaces the
retired nested Rank／Prize fixture assumptions with alpha.34 Rank lineup, stock,
ordering, Draw snapshot stability, and video-failure coverage.

SITE-007 adds MIG-062A contract coverage for typed presentation, nullable assets,
cursor reads, and action states. Component tests cover login/configuration/read
states, individual/select-all/reset behavior, Backend-only bulk actions, and the
no-mutation boundary. Earlier Auth, Catalog, Content, Gacha Presentation, and Draw
operations are checked for alpha.19 compatibility. SITE-005 additionally covers
Browser-owned CSRF, same-key retry, new-operation keys, double-click suppression,
generated Draw problems, public-ID result GET, reload recovery, and the absence
of optimistic Point/Prize mutation. SITE-012 adds Browser fulfillment Contract
coverage plus Component tests for same-key retry, double-click suppression,
typed rejection, successful read reconciliation, and uncertain address
update/delete result reconciliation.

SITE-014 adds alpha.9 mixed-state Catalog Contract coverage for on-sale,
coming-soon, ended, sold-out, anonymous, authenticated-eligible, and
authenticated-ineligible presentation. Tests retain Backend order and verify
that ended/sold-out cards obey display flags despite nonzero fixture counts.

SITE-021 retains the existing Draw boundary while consuming MIG-062J alpha.10.
Draw option buttons directly render generated `allowed_draw_counts`; remaining
units never hide or reduce a requested option. The selected requested count is
sent unchanged. Result recovery reads generated `requested_count` and
`executed_count` independently, uses the latter for completed-count
presentation, and never recalculates Point cost, Prize totals, or sold units.

SITE-048 adds alpha.31 digest／manifest compatibility checks, exact Registration
Client request checks, save-confirmation and Provider-input lifetime tests,
capacity tests, canonical Return read／single-reconcile tests, all terminal and
unavailable failure gates, saved-card Payment 3DS dispatch, opaque-only resume
storage checks, and regressions for existing Card, PayPay, Konbini, and Virtual
Account flows.

SITE-022 extends the existing public Content adapter with MIG-062O alpha.11
`listFooterPages`. A small client component inside the shared Footer renders the
generated collection in returned order through the centralized Static Page
route builder. It performs no Page membership, publication, label, slug, or
ordering decision. Empty and failed reads affect only the Information links;
Brand, Explore, Account, and the Footer shell remain available.

SITE-025 moves Home top-Banner presentation to MIG-062P alpha.14's canonical
`listBanners` collection. The Home does not apply publication, placement, asset,
or link filtering. A client-only native scroll-snap component supplies explicit
pointer, touch, and keyboard controls for multiple returned items without an
automatic interval or additional carousel dependency. Banner loading and errors
are isolated from Category, Gacha, and Notice reads.

SITE-026 separates the `/points` route shell from a client-side presentation
component. `PointBalanceSummary` accepts only display content, the category tabs
hold non-authoritative UI state, and `PointProductRegion`／`PointProductCardShell`
provide layout slots without defining a Platform product response. Runtime passes
no product content, so the page renders the canonical pending `--` balance and a
neutral preparing state. No Adapter, endpoint, purchase action, Payment URL, or
eligibility rule is introduced.

SITE-027 adopts MIG-062U alpha.18 and replaces SITE-026's pending Point content
with generated reads. Product membership and relative ordering remain exactly as
returned; the human-approved category tabs select returned audience codes but do
not decide first-purchase status. Eligibility, reason, sale state, and CTA come
from each product presentation. An enabled purchase CTA is displayed as
available but cannot start a purchase. Point history appends canonical pages in
returned order, passes the opaque cursor back unchanged, and displays signed
deltas, occurred time, and `reason.label` without Ledger-code interpretation.

SITE-028 adopts MIG-062V alpha.19 after verifying the formal Artifact and
byte-identical retention of alpha.18's Point Client files. `/mypage/draws` calls
the generated `listDrawHistory` read through the existing Draw boundary. The UI
maps returned entries without sorting, status/lifecycle interpretation, count
comparison, or Current Gacha lookup. Historical title／image, occurred time,
requested／executed counts, and `status.label` are displayed directly; cursor
continuation appends the next returned page and passes the opaque value back
unchanged.

SITE-029 adopts MIG-062W alpha.20 after verifying that the Public OpenAPI adds
only the LINE Friend State read path and schemas, existing non-Identity Client
modules remain unchanged, and Identity changes only by the additive read.
`/mypage/line` reads `listExternalIdentities` and
`getLineFriendState` through the same receiver-safe generated Identity Client.
The UI displays `status.label`, the returned LINE-user decision, and only the
returned primary action code／label／href. It does not recompute LINE-user status
or infer actions from flags. Unknown action codes, unsafe external schemes, and
Identity/Friend-State contradictions suppress actions and fail closed.

SITE-030 adopts MIG-062Z alpha.21's additive current-user Wallet presentation.
The generated `StorefrontWalletBalance` remains the Point Client boundary and
supplies canonical `total_points`, `as_of`, and ordered
`expiring_within_7_days` buckets. `PointBalanceSummary` displays each returned
`amount` and formats only `expires_at` in `Asia/Tokyo`; it performs no clock
comparison, seven-day calculation, filtering, sorting, aggregation, or balance
reconstruction. Product grant presentation reads only `grant.total_points` and
hides paid/bonus fields. A small presentation-only terminology function converts
the currency word in Backend title/label strings without mutating response
objects or renaming Point Domain identifiers.

SITE-031 applies the same non-mutating currency-word presentation boundary to
Prize inventory names and completes fixed Coin terminology across Prize status,
reason, value, action, confirmation, success, and typed-error text. The shared
helper returns a derived display string and never modifies the generated Prize
object. Existing `point_exchange`, `exchange_points`, response fields, allowed
actions, exchange values, statuses, lifecycle, and mutation/reconciliation flow
remain canonical and unchanged.

SITE-034 adopts the STORE-SITE-034 package-only Artifact. Client and Testkit are
alpha.24 while Site Schema and Public OpenAPI remain alpha.23 references. The
Contact adapter is constructed only with
`createBrowserStorefrontContentContactClient()`, leaving CSRF initialization,
Cookie reading, credentials, and Header construction inside the generated
Client. The form owns only presentation state, canonical field mapping,
duplicate-submit prevention, and receipt／typed-error display; it does not add
retry or Idempotency behavior.

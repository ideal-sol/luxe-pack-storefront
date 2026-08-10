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
9. `src/components/prizes` owns authenticated inventory orchestration and Backend-authoritative selection presentation.
10. `src/components/draw` owns confirmation, transient Idempotency operation state, typed Draw-error presentation, and GET-only result recovery.

## Server and Client Components

Pages, Footer, containers, titles, and static state panels are Server Components by default. Session Provider, Header authentication state, forms, Mobile active-route navigation, Toast state, Confirmation Dialog interaction, and the root error boundary are explicit Client Components with `"use client"`.

The root Session Provider constructs the browser adapter, performs the initial
session read, distinguishes loading/authenticated/unauthenticated/configuration
unavailable/session expired/error states, and refreshes after successful identity
mutations. It stores the typed session response only in memory and does not cache
credentials or authentication material.

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
authentication persistence. Point purchase and Prize fulfillment mutations remain later Tasks.

SITE-003 adds deterministic Client/Testkit contract tests for banners, notices,
categories, tags, gacha summaries, category queries, and cursor queries. Component
tests cover loading, empty, typed errors, missing configuration, image fallback,
navigation, multiple cards, and independence from authenticated/anonymous Session.

SITE-009 adds Content Client/Testkit contract tests for notice cursor reads,
notice detail, and static-page lookup. Component tests cover list/detail/document
states, links, cursor continuation, route switching, long-form structure, and XSS
removal. SITE-004 adds MIG-061Y Testkit coverage for explicit sale states,
anonymous/authenticated eligibility, allowed counts, daily limits, CTA state,
detail UI, prize modal accessibility, and Backend-authoritative presentation fields.

SITE-007 adds MIG-062A contract coverage for typed presentation, nullable assets,
cursor reads, and action states. Component tests cover login/configuration/read
states, individual/select-all/reset behavior, Backend-only bulk actions, and the
no-mutation boundary. Earlier Auth, Catalog, Content, Gacha Presentation, and Draw
operations are checked for alpha.6 compatibility. SITE-005 additionally covers
Browser-owned CSRF, same-key retry, new-operation keys, double-click suppression,
generated Draw problems, public-ID result GET, reload recovery, and the absence
of optimistic Point/Prize mutation.

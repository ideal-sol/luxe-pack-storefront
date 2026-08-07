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

## Testing

Component tests cover the shared shell, session state transitions, forms, duplicate
submission protection, header state, and email verification. Contract tests inject
the deterministic Storefront Testkit into the real browser client. Policy tests
reject direct Platform paths, browser protocol details outside the boundary, and
authentication persistence. Money, Draw, and Point mutations remain later Tasks.

SITE-003 adds deterministic Client/Testkit contract tests for banners, notices,
categories, tags, gacha summaries, category queries, and cursor queries. Component
tests cover loading, empty, typed errors, missing configuration, image fallback,
navigation, multiple cards, and independence from authenticated/anonymous Session.

SITE-009 adds Content Client/Testkit contract tests for notice cursor reads,
notice detail, and static-page lookup. Component tests cover list/detail/document
states, links, cursor continuation, route switching, long-form structure, and XSS
removal. SITE-004 remains held on its separate Platform eligibility contract.

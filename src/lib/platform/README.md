# Platform connection boundary

This directory is the only approved home for Platform connection setup. The
Repository pins the current MIG-062C `@oripa/storefront-client` artifact and exposes narrow browser
authentication and public-read adapters plus runtime configuration, typed error
presentation, and testkit harnesses.

- React components do not fetch Platform endpoints or read API base URLs.
- Browser credentials, cookies, CSRF initialization, protocol headers, endpoint
  paths, request types, response types, and Problem Details parsing remain owned
  by the canonical client artifact.
- Authentication values are never persisted by the Storefront.
- The test helper injects the canonical testkit mock fetch and never contacts a
  live Backend.
- SITE-003 public reads use the canonical Catalog and Content facades. Components
  receive generated banner, category, gacha-summary, notice, and cursor types and
  do not encode endpoint or query behavior.
- SITE-004 detail reads use canonical `getGachaBySlug` and
  `getGachaPresentation` methods. Components render generated sale, eligibility,
  daily-limit, allowed-count, reason, and CTA values without deriving them from
  Session, dates, remaining counts, or Point balance.
- SITE-007 Prize reads expose only canonical `listPrizes` and `getPrize` methods.
  Components use generated `presentation` and `allowed_actions`, not deprecated
  open snapshots, status/date inference, or mutation methods.
- SITE-005 Draw execution uses `createBrowserStorefrontDrawClient`; Components
  never parse Cookies or construct CSRF headers. Result recovery uses only
  `getDrawRequest` and cannot replay a Draw.
- Point purchase, Prize mutation, payment, and missing operations remain Platform
  contracts; this boundary does not invent them.

# Platform connection boundary

This directory is the only approved home for Platform connection setup. SITE-002
pins the MIG-061U `@oripa/storefront-client` artifact and exposes narrow browser
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
- Point, Draw, Prize, payment, and missing operations remain Platform contracts;
  this boundary does not invent them.

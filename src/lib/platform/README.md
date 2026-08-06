# Platform connection boundary

This directory is the only approved home for Platform connection setup. SITE-002
pins the MIG-061U `@oripa/storefront-client` artifact and exposes a narrow browser
authentication adapter plus runtime configuration, typed error presentation, and
testkit harness.

- React components do not fetch Platform endpoints or read API base URLs.
- Browser credentials, cookies, CSRF initialization, protocol headers, endpoint
  paths, request types, response types, and Problem Details parsing remain owned
  by the canonical client artifact.
- Authentication values are never persisted by the Storefront.
- The test helper injects the canonical testkit mock fetch and never contacts a
  live Backend.
- Point, Draw, Prize, payment, and missing operations remain Platform contracts;
  this boundary does not invent them.

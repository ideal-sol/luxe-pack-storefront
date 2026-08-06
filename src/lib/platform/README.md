# Platform connection boundary

This directory is the only future integration point for `@oripa/storefront-client`.

SITE-001 intentionally contains no client dependency, endpoint, response type, authentication flow, point logic, draw logic, or mock business rule. React Components must receive display-ready data through later feature boundaries; they must not read the API base URL or call the Platform API directly.

SITE-002 may introduce the real package only after confirming the published Platform contract. Browser and Server entry points must remain separate: browser mutations use the approved Browser Client, while Server Components use a request-scoped Server Client for safe reads only.

Missing operations are recorded as Pending Contracts in `docs/api-dependency-map.md` and raised as Platform Change Requests. Never invent a path or response shape here.

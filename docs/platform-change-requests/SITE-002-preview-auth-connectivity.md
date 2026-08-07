# SITE-002 Preview authentication connectivity contract

## Status and decision owner

MIG-061Z resolved the Platform-side Public Origin and same-Origin `/api/v2/`
proxy at <https://test.luxe-pack.biz>, including HTTPS and required response
header/Cookie forwarding. The Storefront application itself is not deployed at
that Origin and `/` currently returns HTTP 404. Therefore the routing contract is
resolved on Platform, while full Storefront-plus-API browser authentication E2E
remains pending deployment and is not claimed by SITE-004.

The following text preserves the SITE-002 requirements that MIG-061Z addressed.

Storefront implementation is ready for a same-Origin browser-cookie session, but
SITE-002 does not expose the Public API, configure Platform runtime, or perform a
live Preview authentication trial. Platform and infrastructure owners must select
and approve the routing design using this contract.

## Required externally reachable capabilities

The Public API route must make the MIG-061U authentication operations reachable:

- registration, password login, logout, and current session;
- email-verification notification resend;
- one-time email-verification completion.

The canonical API paths are those in the vendored Public OpenAPI. Any proxy design
must preserve the `/api/v2` path prefix and the remainder of each request path;
rewriting it to a different public contract is not accepted.

## Origin and transport contract

- Platform must set `V2_PUBLIC_ORIGIN` to the exact approved Storefront Origin.
- Platform must decide the Storefront Preview Origin and its production mapping.
- Browser-facing traffic must use HTTPS because the canonical session model uses
  Secure host-only cookies with `__Host-` requirements.
- The selected design must provide a same-Origin proxy; cross-Origin credential
  sharing is not assumed by the Storefront.
- `Set-Cookie` responses must pass through without destructive rewriting.
- The CSRF request header required by the canonical Client must pass through.
- Browser requests use `credentials: include`, owned by the Client artifact.
- Authentication responses must not be cached by a CDN, proxy, or browser cache.
- Allowed methods and request headers must cover the exact Public OpenAPI contract
  without opening unrelated Platform surfaces.

## Items Platform must confirm

Platform must confirm rather than Storefront guessing:

- the external Public API route and same-Origin proxy implementation;
- Preview and production Origin values;
- cookie, CSRF, and redirect URL behavior;
- the email-verification URL that maps canonical `user_id` and `hash` values to
  the Storefront completion route;
- proxy handling for response headers, request Origin, allowed methods/headers,
  and the preserved `/api/v2` path;
- whether health checks need a distinct non-authenticated route.

## Acceptance criteria for a later connectivity task

1. An unauthenticated health check confirms HTTPS route reachability without
   exposing credentials or account data.
2. Session initialization is reachable and marked no-store.
3. Registration, login, logout, current session, resend, and completion routes
   are reachable through the same Origin.
4. Secure host-only cookies and `Set-Cookie` survive the proxy unchanged.
5. The canonical Client supplies credential and CSRF behavior successfully; the
   Storefront adds no manual fallback.
6. Successful login and verification rotate/establish the session, logout
   invalidates it, and an expired session remains a typed failure.
7. Logs and evidence redact passwords, cookies, CSRF values, and verification
   material.

Possible proxy topologies may be compared in that later task. This document does
not preselect Nginx, application proxying, or another infrastructure mechanism.

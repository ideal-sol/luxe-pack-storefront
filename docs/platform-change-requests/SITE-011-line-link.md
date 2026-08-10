# SITE-011 LINE account link follow-up contract

## Status

The core LINE account-link screen is implementable with Production Artifact
`2.0.0-alpha.4`. `listExternalIdentities` provides the current linked identity
collection, and `startLineIdentityLink` returns the canonical LINE authorization
URL. The Storefront passes only the generated `return_path` request field and
does not create OAuth parameters, state, or callback URLs.

The generated Client also publishes `completeLineLogin`,
`startLineReauthentication`, and `unlinkLineIdentity`. Callback code/state
validation and recent-authentication enforcement remain Platform
responsibilities.

## Resolved for SITE-011

- Authenticated current-user external identity collection
- LINE link transaction start
- Platform-owned authorization URL
- Generated callback request and typed External Identity Session
- LINE recent-reauthentication transaction start
- Backend-enforced unlink mutation
- Typed Problem Details boundary
- Safe local `return_path` validation in the published request schema

## Remaining contract decisions

### Friend state

The alpha.4 `ExternalIdentity` schema contains provider, linked time, and last
authenticated time. It does not expose LINE Official Account friend/addition
state. SITE-011 therefore does not display it and does not derive it from the
existence of a LINE identity.

If the product requires this state, Platform should publish a canonical,
machine-readable presentation field and define freshness/error semantics. The
Storefront must not combine identity presence with another signal to infer
eligibility.

### Unlink user journey

The mutation requires recent user reauthentication, but the current read
contract does not expose whether the current Session satisfies that requirement,
and the External Identity start/callback contract does not define a canonical
post-reauthentication continuation for an unlink confirmation screen.

Before exposing an unlink CTA, Platform/Product should confirm:

- the supported reauthentication method selection;
- how the Storefront recognizes a completed recent-authentication ceremony;
- the safe user-confirmation sequence after returning to the Storefront;
- the canonical typed failure when recent authentication is absent or expired;
- Session effects after successful unlink, including the documented invalidation
  of remembered devices and other sessions.

SITE-011 intentionally does not offer a fake or directly callable unlink button.
The published Backend mutation remains the authority and must be used once the
journey above is fixed.

## Callback and redirect boundary

The Storefront consumes only `authorization_url` and `return_path` from the
generated types. It does not parse, persist, log, or recreate OAuth `code`,
`state`, provider tokens, Cookie names, or callback URL parameters. The Platform
callback and generated `completeLineLogin` contract validate the one-time
transaction. Preview acceptance still requires a real external LINE ceremony to
confirm the configured provider redirect lands back on the expected Storefront
route.

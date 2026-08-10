# SITE-005 Draw mutation boundary contract

## Status

**Resolved by MIG-062C `2.0.0-alpha.6` on 2026-08-10.** The historical blocker
below was recorded against MIG-062A `2.0.0-alpha.4` and is preserved. MIG-062C
was produced from source Commit `fedc176f06518edcf9dd57c0387a6d03eee7471b`.

The resolved Artifact provides `createBrowserStorefrontDrawClient`, which keeps
CSRF initialization, Cookie parsing, credentials, and the CSRF header inside the
canonical Client. It also provides generated `DrawProblemCode` and
`isDrawProblemError`; the Storefront does not duplicate the twelve-code union or
parse server detail. `getDrawRequest(id)` remains the canonical completed-result
read used by the reload-safe result Route.

The MIG-062C Manifest, three Package archives, Public OpenAPI, and bundled
`SHA256SUMS` were verified before adoption. Production dependencies are pinned
to alpha.6 through Repository-relative tarballs. Alpha.5 was an unadopted
candidate and was not introduced. Earlier Artifact directories remain immutable.

## Historical blocker record

**Blocking SITE-005 as of 2026-08-10.** MIG-062A `2.0.0-alpha.4` publishes the
Draw mutation, Idempotency input, completed result, and result read. It does not
yet provide a Browser-safe CSRF input boundary for the generated Draw facade or
typed Draw-specific Problem identifiers required for canonical error handling.

This document records the missing Storefront contract without proposing an
endpoint, Cookie name, Error Code, Backend rule, or retry policy.

## Task context

- Storefront Task: `SITE-005`
- Issue: `#15`
- Base SHA: `9b5eb72d545c95a6cfa3462f500cb4bdeb9fd76c`
- Artifact: MIG-062A `2.0.0-alpha.4`
- Artifact source Commit: `a3f8aeb3af5dc7a22f533c2e920e2b1a0c450f33`

Contract authority was checked in this order:

1. `vendor/oripa/MIG-062A/artifact-manifest.json`
2. `vendor/oripa/MIG-062A/public.openapi.json`
3. generated `@oripa/storefront-client` types and runtime
4. `@oripa/storefront-testkit` fixtures and mock boundary

Manifest SHA-256, all three package files, Public OpenAPI, and bundled
`SHA256SUMS` match the vendored formal values.

## Contract already available

The generated Draw client exposes:

- `createDraw(gachaId, drawCount, options)`;
- `getDrawRequest(drawRequestId, signal?)`;
- generated `DrawCount`;
- required Idempotency Key input;
- required CSRF token input;
- generated completed `DrawResponse`.

The mutation response provides the canonical Draw Request public ID, Gacha ID,
completed status, requested/executed count, total Point cost, Point consumption,
wallet snapshot, Rank counts, Prize counts, Point-back total, bounded high-rank
results, optional bounded individual results, replay marker, request ID, processing
duration, and creation time. Prize references include name and nullable
presentation asset; Rank references are typed.

The result read returns the same generated response by Draw Request public ID and
is sufficient for reload-safe presentation without replaying the mutation.

The Client also exports its canonical Idempotency Key generator. The transport
keeps the same key for its bounded automatic retry of an idempotent mutation.
SITE-005 can retain that generated key in transient operation state for a user-
requested retry and create a new key only for a new operation.

## Blocker 1: Browser CSRF ownership gap

Generated `createDraw` requires `options.csrf_token` and validates that value
before calling the transport. The Browser transport can initialize CSRF and read
the canonical CSRF Cookie internally, but the public Draw facade does not expose a
Browser mutation method that can use that internal reader without the consumer
supplying the token first.

The Storefront cannot safely satisfy this by:

- reading a Cookie in a React Component;
- duplicating Cookie parsing in a Storefront adapter;
- importing a Cookie name and reconstructing the protocol;
- passing a fabricated token;
- bypassing the generated Draw facade with a handwritten request.

Platform needs to publish a Browser-safe Draw mutation boundary that keeps CSRF
initialization, Cookie reading, and header construction inside the canonical
Client. This may be an additive facade or another documented Client-owned
mechanism; SITE-005 does not prescribe its implementation.

## Blocker 2: Draw-specific Problem type gap

The Public OpenAPI operation uses the generic Problem Details schema whose
`code` is only a patterned string. The generated Client exports a typed Auth
Problem union, but no equivalent Draw-specific Problem union or classifier is
published. The Testkit provides a successful Draw fixture but no canonical typed
fixtures for Draw rejection categories.

SITE-005 acceptance requires the Storefront to distinguish Backend-authoritative
rejections including Point insufficiency, current eligibility, daily limit,
sale/inventory state, invalid count, Idempotency conflict, and authentication
where the Platform actually supports them. Without a published typed contract,
adding identifiers or matching arbitrary strings would duplicate or invent Error
Codes.

Platform needs to publish the machine-readable Draw Problem surface through the
OpenAPI/Generated Client/Testkit, including which rejection categories are
possible, their retry semantics, and a typed classifier or equivalent generated
union. Unknown problems will continue to use the existing safe generic message;
server `detail` will not be shown unconditionally.

## Required Storefront behavior after resolution

- Continue using SITE-004 `getGachaPresentation`, CTA state, eligibility, and
  returned `allowed_draw_counts` only as pre-mutation presentation.
- Let the Draw mutation revalidate sale, inventory, eligibility, daily limit,
  count, and Point sufficiency.
- Generate one canonical Idempotency Key per user operation and retain it for the
  same operation's retry without URL or persistent storage.
- Prevent duplicate submission and never optimistically change Point or Prize
  inventory.
- Navigate with the returned Draw Request public ID and use `getDrawRequest` on
  every result-page load. Reload and Back must not submit another Draw.
- Display only generated result fields and nullable asset fallbacks.

## Testkit acceptance

The resolved bundle should allow deterministic tests for:

- Browser-owned CSRF preparation and Draw submission;
- one key per operation, same-key retry, and new-key new operation;
- duplicate-click suppression;
- the published Draw rejection categories and retry semantics;
- successful Draw Request public ID extraction;
- result reload, not found, typed error, multiple Prize counts/results, and image
  fallback;
- no mutation during result reads or Browser navigation.

Fixtures must remain public-safe and must not contain production credentials,
Cookie values, Tokens, PII, or real user/product data.

## Resume criteria

SITE-005 can resume when a versioned, integrity-verifiable Artifact provides:

1. a Browser-safe generated Draw mutation that does not require Storefront Cookie
   parsing or protocol reconstruction;
2. a generated Draw-specific Problem contract sufficient for the required error
   states;
3. deterministic Testkit coverage for those additions; and
4. non-breaking retention of current Auth, Catalog, Content, Gacha Presentation,
   Draw Result, and Prize Inventory contracts.

These resume criteria were satisfied by MIG-062C. SITE-005 now implements the
Draw UI, generated mutation adapter, and result Route without speculative error
mapping. Point insufficiency before execution remains outside presentation; the
typed mutation rejection is authoritative.

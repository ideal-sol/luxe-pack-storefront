# SITE-012 Prize fulfillment mutation boundary

## Status

**Resolved by MIG-062E `2.0.0-alpha.8` on 2026-08-12.** The historical blocker
below was recorded against MIG-062C `2.0.0-alpha.6` and is preserved. MIG-062E
publishes the Browser-safe fulfillment client, typed fulfillment Problem
classifier, and explicit mutation retry semantics needed by SITE-012.

This request originally recorded the boundary
required before Storefront shipping and point-exchange mutations can be
implemented without handling Browser authentication protocol details or
inventing Backend rejection codes.

## Resolution record

- Production Artifact: MIG-062E `2.0.0-alpha.8`
- Artifact source commit: `5c9053ca2434847032a51f8b4f09dd25c8ef8535`
- Artifact authority: `vendor/oripa/MIG-062E/artifact-manifest.json`
- `createBrowserStorefrontPrizeShippingClient` now owns Session/CSRF Cookie and
  header handling; React Components receive no Cookie or CSRF token value.
- Caller Idempotency Keys are supported for point exchange, address create, and
  shipping request creation. Same-operation retry retains the same key.
- Address update/delete are explicitly `reconcile-before-retry`; SITE-012 does
  not automatically retry them and checks `getShippingAddress` or
  `listShippingAddresses` after an uncertain transport result.
- Generated `FulfillmentProblemCode` and `isFulfillmentProblemError` provide the
  reviewed typed boundary. Unknown codes remain generic `ApiProblemError`; the
  UI does not parse Backend `detail`.
- Successful mutations are followed by canonical Prize, Shipping, and Address
  reads. Optimistic Prize status or Point balance is not authoritative.

The Browser mutation blockers are resolved. Prize status grouping and expiry
semantics remain separate Pending Contracts and are not inferred by SITE-012.

## Context

- Storefront task: `SITE-012`
- Risk: `R3`
- Production Artifact: MIG-062C `2.0.0-alpha.6`
- Artifact source commit: `fedc176f06518edcf9dd57c0387a6d03eee7471b`
- Artifact authority: `vendor/oripa/MIG-062C/artifact-manifest.json`

SITE-007 already renders `presentation` and uses
`allowed_actions.shipping`, `allowed_actions.point_exchange`, and
`allowed_actions.selection` as the pre-action UI authority. SITE-012 must still
submit selected Prize IDs to Backend mutations, where the Backend revalidates
every Prize and remains authoritative for stale state, payment hold, expiry,
status, and action availability.

## Published Contract confirmed

The alpha.6 Public OpenAPI and generated Prize Shipping Client publish:

- `listPrizes` and `getPrize`;
- `listShippingAddresses`, `getShippingAddress`, `createShippingAddress`, and
  `updateShippingAddress`;
- `listShippingRequests`, `getShippingRequest`, and
  `createShippingRequest`;
- `exchangePrizes` for point exchange;
- generated request and success-response schemas for selected Prize IDs,
  address input, shipping request summaries/details, and exchange results;
- required Idempotency Keys for shipping-request creation and point exchange;
- generic RFC 9457 `ProblemDetails` transport errors.

These operations are not sufficient for the required Browser mutation UI for
the reasons below.

## Blocker 1: Browser-managed CSRF boundary is missing

`StorefrontPrizeShippingClient` requires the caller to provide `csrf_token` to
`exchangePrizes`, `createShippingRequest`, and the address mutations. The
generated Facade validates that token and writes the CSRF header itself.

The Browser package publishes `createBrowserStorefrontDrawClient` for Draw, so
Draw Components and adapters do not read Cookie names, parse Cookie values, or
construct the CSRF header. No equivalent Browser-safe Prize fulfillment Facade
is published in alpha.6.

Storefront must not solve this by importing Cookie constants, reading
`document.cookie`, parsing a CSRF Cookie, or passing a token through React state.
That would duplicate the Platform protocol and violate the established Browser
boundary.

### Required Platform outcome

Publish a generated/supported Browser Prize fulfillment boundary that:

- owns canonical Session/CSRF initialization and current CSRF token reading;
- does not expose Cookie names, CSRF token values, or CSRF header construction
  to Storefront Components or adapters;
- accepts caller-owned Idempotency Keys for shipping and exchange;
- supports same-key retry of the same operation without creating a second
  fulfillment mutation;
- exposes address reads and only those address mutations that are safe for the
  Browser journey.

The Platform may choose the concrete factory and method names. This request does
not prescribe an endpoint or generated API name.

## Blocker 2: typed fulfillment rejection Contract is missing

The shipping, exchange, and address operations currently reference only the
generic `ProblemDetails` response. Its `code` is an unconstrained string. The
generated Client exports typed Auth and Draw code unions/classifiers, but does
not export a Prize fulfillment Problem code union or classifier.

Therefore Storefront cannot distinguish the required fulfillment outcomes
without guessing strings or parsing `detail`, including:

- stale selection or concurrent Prize-state change;
- shipping or point-exchange action rejected by Backend revalidation;
- payment hold;
- Idempotency conflict or an operation already in progress;
- invalid selected Prize IDs or invalid address input;
- authentication, CSRF, and rate-limit rejection;
- retryable versus final failures in the fulfillment journey.

### Required Platform outcome

Publish the actual machine-readable rejection set in Public OpenAPI and expose
its generated type/classifier from the Client. Each fulfillment mutation should
reference the typed response while retaining a safe generic Problem fallback for
forward compatibility. The Storefront must be able to map known generated codes
to reviewed UI messages and show an unknown failure safely without rendering
Backend `detail` unconditionally.

The Platform owns the actual code names, statuses, and retry semantics. SITE-012
must not create a local enum from the conceptual cases above.

## Address and PII requirements

The existing schemas define the available address fields and masked list
presentation. The completed Browser contract must preserve these rules:

- full address input or detail is never placed in a URL;
- address and phone data are not logged or stored in LocalStorage or
  SessionStorage;
- test fixtures use synthetic, non-real values;
- timeout or repeat-submit behavior for non-idempotent address creation is
  explicitly documented so the UI does not silently create duplicates.

## Testkit requirements

Provide deterministic, public-safe Contract coverage for:

- Browser-managed CSRF followed by shipping and exchange;
- Idempotent success and same-key replay;
- stale/conflict and Backend action rejection;
- payment-hold rejection;
- address list/detail and supported validation failures;
- success responses used to refetch the Prize inventory;
- unknown Problem fallback.

Fixtures must not become a separate Production response authority.

## Storefront acceptance after resolution

SITE-012 can resume when the published Production Artifact allows the Storefront
to implement and test all of the following without handwritten Cookie/CSRF
handling or guessed error codes:

1. select an existing address or use a supported safe address form journey;
2. confirm and submit a shipping request with one operation key;
3. confirm and submit a point exchange with one operation key;
4. retry the same uncertain operation with the same key;
5. present generated known rejections and a safe unknown fallback;
6. refetch Prize inventory only after a canonical successful response.

Until then SITE-012 performs no fulfillment mutation, optimistic Prize-state
change, Point-balance update, or Preview shipping/exchange.

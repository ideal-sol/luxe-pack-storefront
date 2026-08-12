# SITE-014 Gacha catalog display contract alignment

## Status

Resolved by MIG-062G Production Artifact `2.0.0-alpha.9`.

The historical MIG-062E `2.0.0-alpha.8` blocker analysis is retained below.

## MIG-062G resolution

- Production Artifact: `2.0.0-alpha.9`
- Source Head: `36220b5c08820741b4763363a7e86c18274b9688`
- Artifact authority: `vendor/oripa/MIG-062G/artifact-manifest.json`
- Existing `listGachas` query preserves category, tag, opaque cursor, limit, and
  Backend-stable ordering.
- Generated `GachaSummary.presentation` supplies sale state, user state,
  audience, eligibility, machine-readable reason, allowed counts, daily limit,
  CTA, and display flags.
- The Platform returns Backend-designated catalog-visible entries across sale
  states, including ended, sold-out, and authenticated-ineligible entries.
- `display.show_price_points`, `display.show_total_count`, and
  `display.show_drawn_count` resolve the omission policy without date/count
  inference.
- Testkit supplies on-sale, coming-soon, ended, sold-out, anonymous,
  authenticated-eligible, and authenticated-ineligible fixtures.

SITE-014 consumes these generated facts without filtering returned items or
redefining Detail/Draw eligibility. Draw Mutation continues to revalidate every
business rule. Optional featured placement remains outside this resolution.

## Historical blocker record

The MIG-062E `2.0.0-alpha.8` contract could not implement the confirmed display
rules without inferring sale state from timestamps or remaining counts, or
issuing an incomplete per-item workaround. No Frontend workaround was made while
the task was blocked.

## Confirmed Storefront behavior

Catalog surfaces must:

- include Gacha entries whose sale has ended;
- include Gacha entries that sold out during their sale period;
- include Gacha entries for which the authenticated user is not eligible;
- omit consumption Point, total-unit count, and Draw-count presentation for an
  ended or sold-out Gacha;
- never infer ended, sold-out, audience eligibility, or display inclusion from
  dates, `remaining_count`, Session state, or other Frontend-combined fields.

The Platform remains authoritative for publication, sale state, audience,
eligibility, inventory, and ordering decisions.

## Historical alpha.8 Contract audit

Authority reviewed:

1. `vendor/oripa/MIG-062E/artifact-manifest.json`
2. `vendor/oripa/MIG-062E/public.openapi.json`
3. `@oripa/storefront-client` `2.0.0-alpha.8`
4. `@oripa/storefront-testkit` `2.0.0-alpha.8`
5. SITE-003 Catalog and SITE-004 Detail implementation/tests

### Catalog list

The published Catalog list operation is described as returning Gacha entries
within the public period. It is an anonymous public read with a public 60-second
cache policy. Its existing query contract supports:

- limit;
- category;
- tag;
- opaque cursor continuation.

The returned generated `GachaSummary` contains ID, slug, title, Point price,
total/remaining counts, publication dates, category, tags, and presentation
asset. It does **not** contain Backend-classified sale state, user state,
eligibility, ineligible reason, CTA state, or a display-fact policy.

Consequences:

- an ended Gacha is not guaranteed to be returned because the operation is
  explicitly scoped to the public period;
- sold-out inclusion is not an explicit response or operation guarantee;
- authenticated-user audience ineligibility cannot be represented by an item;
- the Card cannot safely decide when to omit Point/total/Draw facts;
- deriving state from `publish_end_at` or `remaining_count` would violate the
  Platform boundary.

### Detail presentation

The separate generated Gacha presentation read provides Backend-authoritative:

- sale state (`coming_soon`, `on_sale`, `sold_out`, `ended`);
- anonymous/authenticated user state;
- audience eligibility and machine-readable ineligible reason;
- allowed Draw counts, daily limit, and CTA state.

This resolves the Detail journey but does not resolve the list contract. Calling
it once per list item is not a sufficient workaround because:

- the list still does not return ended entries;
- sold-out inclusion remains unspecified;
- the public list and private/no-store presentation reads have different cache
  and authentication semantics;
- N per-item reads would not define one cursor-consistent list presentation;
- it would make partial failures and list-level error behavior ambiguous.

The Gacha Detail schema also exposes sale state only as an optional property;
SITE-004 correctly uses the explicit presentation read as its state authority.

### Testkit and current UI

The alpha.8 Testkit publishes an on-sale Catalog fixture and a separate Detail
presentation fixture. It does not provide list fixtures/contract assertions for
ended, sold-out, anonymous presentation, or authenticated-ineligible entries.

The existing SITE-003 `GachaCard` always renders Point price and
remaining/total units because no list state exists. Home and Catalog reads are
intentionally independent of Session. SITE-004 uses the separate canonical
presentation state. No existing Frontend code calculates list sale or audience
state.

## Required Catalog behavior

The Platform should publish a list contract that returns every
Backend-designated catalog-visible Gacha, including:

- ended Gacha entries;
- Gacha entries sold out during the sale period;
- Gacha entries for which the current authenticated user is not eligible.

Audience ineligibility must affect presentation/action state, not silently
remove an otherwise catalog-visible item. The Platform owns any retention,
visibility, and order policy for ended entries. Unpublished or administratively
hidden content remains a Backend decision.

The concrete endpoint name and Backend implementation are intentionally not
prescribed by this request.

## Required item presentation

For each list item, the response must allow the Storefront to consume, without
recalculation:

- Backend-classified sale/display state;
- whether the item is catalog-visible;
- authenticated/anonymous presentation context;
- authenticated-user eligibility when applicable;
- a machine-readable ineligible reason when applicable;
- enough Backend-authoritative presentation information to omit Point price,
  total units, remaining/Draw-count facts for ended and sold-out states.

The Platform may model these facts in the summary, a parallel presentation
object, or another generated representation. The generated OpenAPI/Client type
must be the sole Production authority. The Storefront will not define a local
response shape or enum.

## Anonymous response requirements

Anonymous Catalog reads must:

- return Backend-designated catalog-visible on-sale, sold-out, and ended items;
- represent an explicit anonymous presentation context;
- distinguish sale/display state without requiring timestamps/count inference;
- provide an unambiguous authentication-required presentation where user-specific
  eligibility cannot be established;
- preserve the same category/tag/cursor semantics;
- avoid exposing private user state.

## Authenticated response requirements

Authenticated Catalog presentation must:

- retain catalog-visible items even when the current user is ineligible;
- identify eligible/ineligible presentation using the same canonical eligibility
  decision used by Gacha Detail/Draw eligibility;
- provide a machine-readable ineligible reason suitable for reviewed UI mapping;
- never require the Storefront to infer audience from first-use, LINE identity,
  daily-limit, or Session fields;
- prevent one user's presentation from being cached or served to another user.

If public list data and user-specific presentation are separated, the Platform
must define an atomic or otherwise cursor-consistent composition contract and
partial-failure behavior. The Storefront must not invent that orchestration.

## Existing Catalog behavior to preserve

The aligned contract must preserve:

- category filtering;
- tag filtering;
- opaque cursor continuation and stable next-cursor semantics;
- limit behavior;
- Backend-returned ordering;
- generated request/response types;
- existing public asset, title, slug, category, and tag facts;
- anonymous access to Catalog browsing.

Adding ended/sold-out/ineligible presentation must not redefine cursor values in
the Frontend or require local filtering after pagination.

## Error contract

The published contract must define generated Problem Details for list-level
failures and, if presentation is composed separately, the behavior when user
presentation cannot be obtained. It must make the distinction between:

- an empty successful Catalog;
- invalid category/tag/cursor input;
- authentication/session expiry for user-specific presentation;
- temporary presentation/eligibility unavailability;
- rate limiting and generic forward-compatible failure.

Known machine-readable codes, if any, must be generated from Public OpenAPI.
Unknown errors remain generic. Backend `detail` must not be parsed as a state or
display decision.

## Cache contract

The Platform must explicitly define cache behavior for both contexts:

- anonymous catalog facts may use a public cache only when no user-specific
  state is present;
- authenticated eligibility/reason presentation must be private and must not
  leak across users;
- sale/display transitions and sold-out state must have a freshness/invalidation
  policy compatible with Backend authority;
- cursor pages must remain internally consistent under the chosen cache model;
- required `Cache-Control`/`Vary` behavior must be published and preserved by
  the existing same-Origin proxy.

The Storefront will not add CORS, Cookie, or cache protocol rules in Components.

## Detail and Draw consistency

List presentation must align with the existing canonical contracts:

- the same Gacha must not have contradictory list and Detail sale states;
- authenticated eligibility/reason must use the same canonical decision family
  as the Detail presentation;
- list eligibility is presentation only; Draw Mutation must revalidate all
  eligibility, sale, inventory, allowed-count, daily-limit, and Point rules;
- ended/sold-out items remain navigable to their canonical Detail when the
  Backend designates them catalog-visible;
- hiding Point/count facts in list/detail presentation must not change Draw
  request or result contracts.

## Testkit acceptance

A resolving Production Artifact should provide deterministic, public-safe
coverage for at least:

- anonymous on-sale, sold-out, and ended list items;
- authenticated eligible and ineligible list items;
- machine-readable ineligible reason;
- ended/sold-out item facts required for safe omission of Point/count display;
- category and tag filters;
- multi-page cursor continuation containing mixed sale states;
- empty response and typed/error fallback behavior;
- cache/authentication boundary assertions;
- consistency with Gacha Detail presentation fixtures.

## Storefront resume criteria

SITE-014 may resume when a versioned Production Artifact lets the Storefront:

1. render ended, sold-out, and authenticated-ineligible items returned by the
   canonical Catalog contract;
2. use Backend state to omit Point price, total units, remaining/Draw-count facts
   for ended/sold-out entries;
3. preserve category/tag/cursor behavior without local post-filtering;
4. test anonymous/authenticated presentation and cache/error behavior through
   generated Client types and Testkit fixtures;
5. retain existing Detail and Draw authority without Frontend business-rule
   reconstruction.

Until then, SITE-014 makes no Catalog UI, adapter, API, route, or business-rule
change.

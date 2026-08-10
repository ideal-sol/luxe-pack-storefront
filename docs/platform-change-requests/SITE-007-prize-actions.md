# SITE-007 prize inventory display and actions contract

## Status

**Resolved for SITE-007 by MIG-062A on 2026-08-07.** The following paragraph
preserves the original blocker record. The pinned MIG-061U artifacts exposed a
User Prize collection, status, point value, acquisition time, and storage expiry,
but do not provide generated display fields or Backend-authoritative action
eligibility required by the accepted inventory UI.

This document records Storefront presentation needs without selecting an endpoint,
database implementation, state transition, or action rule.

## Resolution by MIG-062A

Platform published the Production Contract `2.0.0-alpha.4` from source Commit
`a3f8aeb3af5dc7a22f533c2e920e2b1a0c450f33`. Its Manifest, three packages,
Public OpenAPI, and bundled `SHA256SUMS` were verified before adoption.

The existing canonical reads remain `prizeShipping.listPrizes(cursor?)` and
`prizeShipping.getPrize(prizeId)`. Generated `UserPrize.presentation` now provides
the prize public ID, name, nullable image, and typed rank. Generated
`UserPrize.allowed_actions` provides `shipping`, `point_exchange`, and
`selection`, each with a Backend-authoritative `allowed` value and nullable typed
`unavailable_reason`. SITE-007 uses those generated types and does not read the
deprecated open `display` or `rank` snapshots.

This resolves the list, card, selection, and action-tray contract. Cursor
continuation remains unchanged. Later mutation Tasks must ask Backend to
revalidate every selected item and must not treat the presentation as mutation
authorization.

## Remaining contract questions

- No canonical status grouping or status-filter query is published. SITE-007
  therefore displays literal generated status badges and does not invent tabs.
- Detailed expiry/grace-period/automatic-conversion rules remain unspecified.
  `storage_expires_at` is display-only; status and allowed actions remain
  authoritative.
- Group mutation compatibility and stale-selection errors remain responsibilities
  of the later shipping and point-exchange mutation contracts.

## Contract audit

Authority checked in order:

1. `vendor/oripa/MIG-061U/artifact-manifest.json`
2. `vendor/oripa/MIG-061U/public.openapi.json`
3. `@oripa/storefront-client` `2.0.0-alpha.1`
4. `@oripa/storefront-testkit` `2.0.0-alpha.1`

The OpenAPI operations are `listUserPrizes` and `getUserPrize`. The canonical
Client facade exposes them as `prizeShipping.listPrizes(cursor?)` and
`prizeShipping.getPrize(prizeId)`. Both reads require the existing browser Session
and use the Client transport boundary.

The generated `UserPrize` type currently guarantees:

- `id`;
- the canonical `status` enum;
- `exchange_points`;
- `acquired_at`;
- `storage_expires_at`;
- `draw_result_id`;
- nullable `display` and `rank` values typed only as open objects.

The collection provides `items` and nullable `next_cursor`. Detail adds
`status_history` but does not refine `display`, `rank`, or action eligibility.

The canonical status enum is:

- `stored`;
- `exchange_processing`;
- `converted`;
- `shipping_requested`;
- `packing`;
- `shipped`;
- `delivered`;
- `hold`;
- `return_requested`;
- `returned`;
- `expired`;
- `canceled`.

The Testkit fixture happens to include `id`, `name`, and `presentation_asset`
inside `display`, and `id`, `code`, and `name` inside `rank`. Those members are not
defined by the higher-authority OpenAPI schema or generated Client type, so the
Storefront cannot use the fixture shape as a production contract.

## Core inventory blocker

The accepted Prize Card requires a canonical prize name and image fallback input,
and should display rank when available. The current generated type does not define:

- prize display identity and name;
- prize presentation asset and its typed media/alt fields;
- rank identity, code, name, or display order.

Rendering an opaque ID as the card title or casting the open objects to the Testkit
fixture shape would fabricate a response contract. Because these fields are core
to a usable inventory list, SITE-007 cannot complete the list UI safely.

## Missing action contract

No audited response provides:

- the actions allowed for each owned prize;
- whether the prize may be selected for shipping;
- whether it may be selected for point exchange;
- whether it is not selectable;
- an unavailable/disabled reason;
- a Backend-authoritative expiration/action decision;
- compatibility of a selected group with a bulk action.

The existence of shipping and exchange mutation operations does not authorize
either action for a particular item. The Storefront must not derive eligibility
from `status`, `storage_expires_at`, `exchange_points`, current time, or mutation
request schemas.

## Screen purpose

Support `/mypage/prizes` as an authenticated inventory screen with:

- Backend-defined status tabs;
- recognizable prize cards;
- individual selection;
- action-scoped select all and reset;
- a mobile bulk-action tray showing only Backend-authorized actions;
- no mutation in SITE-007.

## Required read contract

The versioned OpenAPI, Client, and Testkit need typed semantics for each inventory
item's:

- canonical display name;
- nullable presentation asset using a published asset schema;
- optional rank reference using a published rank schema;
- canonical status;
- acquisition time;
- storage/action deadline when applicable;
- point exchange value;
- allowed actions;
- unavailable reason when no action or a specific action is disabled.

Platform should determine whether action eligibility is included in the list read,
a separate context-aware read, or another versioned capability. SITE-007 does not
prescribe an endpoint.

## State semantics

The existing status enum may be presented with localized labels, but Platform must
document which states belong in each desired inventory view and whether filtering
is a Backend query or a purely literal status filter. The Storefront will not
collapse states into inferred shipping, exchange, or expired groups without a
published mapping.

## Allowed actions

The response must provide the exact typed action set for the current user and item.
It must distinguish at least:

- selectable for a shipping flow;
- selectable for a point-exchange flow;
- not selectable;
- any additional action supported by the Platform.

The names above describe UI needs, not proposed enum values. Platform must publish
the canonical enum and semantics. An empty action set needs explicit meaning.

## Deadline and expiration

`storage_expires_at` may be formatted for display, but it cannot be used by the
Storefront to decide expiration, action availability, or automatic exchange.
Backend must return the authoritative state and action set after applying its time
zone, grace period, hold, and lifecycle rules.

## Point exchange value

`exchange_points` is available and may be displayed. Platform must confirm whether
zero has a specific UI meaning and whether the value is final for a proposed bulk
selection. The Storefront will not infer point-exchange eligibility from a positive
value.

## Pagination

The existing `next_cursor` contract is sufficient for continuation if the resolved
display/action fields are returned on every item. The Storefront will pass the
cursor back unchanged and will not invent numbered pagination.

## Error contract

The read capability must continue to use published Problem Details and provide
typed behavior for:

- authentication required or Session expired;
- inventory unavailable;
- item no longer available between pages;
- stale action eligibility when later mutation Tasks begin;
- transient failure and rate limiting.

Unknown problems will use the existing safe generic presentation. Server detail
will not be displayed unconditionally.

## Original acceptance criteria for resuming SITE-007

These criteria preserve the blocker-time request. MIG-062A satisfied the display
need through the new typed `presentation` property while retaining the old open
snapshots only as deprecated compatibility fields.

- Updated versioned artifacts define display and rank fields instead of open
  objects.
- The list response provides the Backend-authoritative allowed action set and
  unavailable reason.
- Deadline and status semantics explicitly prohibit the need for Frontend
  eligibility inference.
- Client types expose the fields without Component casts or handwritten response
  interfaces.
- Testkit deterministically covers multiple statuses, missing assets, pagination,
  selectable actions, and non-selectable items.

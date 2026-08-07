# SITE-004 gacha detail eligibility contract

## Status

**Resolved for SITE-004 by MIG-061Y on 2026-08-07.** The following paragraph is
the preserved historical blocker record.

**Blocking SITE-004 as of 2026-08-07.** The pinned MIG-061U artifacts expose the
public detail content, but they do not expose the Backend-authoritative state
required to render draw eligibility or the allowed draw-count controls.

This document describes the Storefront need without selecting an endpoint name,
Backend implementation, or response shape.

## Resolution by MIG-061Y

Platform published version `2.0.0-alpha.2` from source Commit
`12610e1fefa9c4a6cb555fdd933253bbe54dd0e4`. Its generated Catalog Client exposes
`getGachaPresentation(gachaId)` separately from the public detail read. The
generated presentation response resolves the historical blocker with explicit:

- sale state (`coming_soon`, `on_sale`, `sold_out`, or `ended`);
- anonymous/authenticated user state and audience;
- eligibility and a machine-readable ineligible reason;
- ordered allowed draw counts;
- daily limit, used, remaining, unlimited, and reset timestamp values;
- CTA visibility/state, action, and reason.

The Storefront renders these generated values and does not recreate
`V2DrawEligibilityService` decisions. One adjacent concern remains pending:
MIG-061Y intentionally does not provide a detail-time canonical Point-insufficient
decision. SITE-004 therefore does not compare Point balance with price or alter
CTA state; SITE-005 or a later contract must use a Backend-authoritative result.

## Contract audit

Authority checked:

1. `vendor/oripa/MIG-061U/artifact-manifest.json`
2. `vendor/oripa/MIG-061U/public.openapi.json`
3. `@oripa/storefront-client` `2.0.0-alpha.1`
4. `@oripa/storefront-testkit` `2.0.0-alpha.1`

The canonical detail method is `catalog.getGachaBySlug(slug)`. It returns the
generated `GachaDetailResponse`, whose `data` currently provides:

- `id`, `slug`, `title`, and `price_points`;
- `total_count` and `remaining_count`;
- `publish_start_at` and nullable `publish_end_at`;
- `category` and `tags`;
- nullable `presentation_asset`, `description`, and `notices`;
- ordered `ranks`, including rank identity, name, presentation assets, and prizes;
- `probability_stages`, including the current-stage marker, returned rank
  probabilities, point-back total, and minimum-guarantee data.

Prize data provides `id`, `name`, nullable `description`, `display_price`,
`exchange_points`, and nullable `presentation_asset`. These fields are sufficient
for a public main visual, basic information, remaining/total presentation, rank
sections, prize cards, prize modal, and returned probability information.

The public detail operation is unauthenticated and returns the same generated
shape regardless of browser Session. Neither the OpenAPI operation nor the Client
exposes a detail-time user context.

## Missing core information

The audited response does not provide:

- Backend-authoritative sale/display state;
- whether the current user is eligible to draw;
- the exact draw counts allowed for this gacha and current user;
- an ineligible reason suitable for safe Storefront mapping;
- a daily limit or the current user's remaining daily count;
- a Backend-authoritative CTA enabled/disabled decision;
- a sold-out, ended, or coming-soon state that the Storefront can distinguish
  without deriving it from counts or timestamps.

`CreateDrawRequest.draw_count` accepts the protocol-level values `1`, `5`, `10`,
`100`, and `1000`. That mutation request enum is not an allowed-count response for
a particular gacha or user and therefore cannot be used to populate SITE-004
buttons. The Storefront must not convert this enum into eligibility policy.

Likewise, `remaining_count`, `total_count`, `publish_start_at`, and
`publish_end_at` may be displayed, but the Storefront must not derive sale,
sold-out, coming-soon, ended, inventory, or eligibility decisions from them.

## Purpose

Provide the Backend-authoritative presentation contract needed for the public
gacha detail CTA, without moving eligibility, sales, inventory, point, or
daily-limit decisions into the Frontend.

## Authentication

The gacha detail must remain publicly viewable. User-specific eligibility and
limits require an authenticated browser Session when present, while anonymous
visitors need an explicit anonymous/login-required result. Platform must decide
whether this is one context-aware read or a separate capability; SITE-004 does
not prescribe an endpoint.

## Request identification

The capability must identify the canonical gacha by an existing public identifier
or slug and use the current browser Session where user-specific evaluation is
required. It must not require the Storefront to send a guessed user identifier,
Cookie name, CSRF header, or eligibility input.

## Required response semantics

The published Client and Testkit need typed, documented semantics for:

- the Backend-authoritative sale/display state;
- whether the CTA is enabled;
- whether authentication is required before draw selection or execution;
- current-user eligibility when authenticated;
- the exact allowed draw-count list for the current state and user;
- remaining daily count when a daily limit applies;
- a stable, typed ineligible reason when eligibility is false;
- whether no draw control should be displayed for sold-out or terminal states;
- whether and when the result may be cached in anonymous and authenticated
  contexts.

The allowed draw-count list must be authoritative and ordered. An empty list must
have explicit semantics rather than requiring the Frontend to infer a reason.

## Error contract

The capability must use the published Problem Details boundary and distinguish at
least the cases necessary for the Storefront to safely render:

- detail not found or not publicly viewable;
- authentication required or Session expired;
- user not eligible;
- daily limit reached;
- sale/display state preventing a draw;
- transient failure.

Platform should publish the typed codes and user-display policy. The Storefront
will retain its safe unknown-error fallback and will not display arbitrary server
detail or maintain a duplicate guessed code list.

## Storefront UI consumers

The resolved contract will drive:

- Sticky Draw CTA visibility and enabled state;
- only the returned draw-count buttons;
- login guidance for anonymous users;
- eligibility and ineligible-reason messaging;
- daily remaining display when supplied;
- sold-out, ended, coming-soon, or other explicit Backend state presentation;
- the boundary handed to SITE-005 before any Draw mutation.

Until this contract is published in the OpenAPI, Client, and Testkit, SITE-004
must not implement fake count buttons, timestamp/count-based sale decisions, or
Frontend eligibility logic.

## Acceptance for resuming SITE-004

- Updated versioned artifacts publish the capability and generated types.
- The Client exposes the canonical read without requiring Component-level fetch.
- The Testkit can deterministically cover anonymous, eligible, ineligible,
  daily-limited, and explicit sale/display states.
- Allowed draw counts are returned per Backend decision rather than inferred from
  the Draw mutation request enum.
- Error and cache behavior are documented.

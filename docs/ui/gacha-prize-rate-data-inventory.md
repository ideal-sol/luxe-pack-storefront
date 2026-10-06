# Gacha prize rate UI: source and required data

This change uses the canonical `oripoke-prize-rate.zip` delivery, design commit
`dcf678237b9b790b71a14c4b70020f8b35bda9e0`, on protected main
`b9224c900191ede206d89af768a62998f72aca20`. It covers the ordinary Gacha detail
link and `/gachas/[slug]/prize-rate`. TOP, Coin purchase, first-purchase offers,
countdowns, and Login Gacha are outside this change.

## Canonical delivery

The ZIP contains a README, matching patch and Git bundle, and five comparison
screenshots: detail link at 1280/390, closed rate page at 1280, and expanded rate
page at 1280/390. These are reference screenshots, not product image assets.
The delivered component, route, CSS, percentage formatter, and tests are reused.
Existing brand images, local fonts, header, footer, and mobile navigation remain
the shared presentation shell. No new image assets or dependencies are needed.

The following narrow corrections accompany the delivered layout:

- If Backend marks no probability stage current, show the information-unavailable
  message instead of choosing an arbitrary first stage.
- Remount the request view on slug navigation so the previous Gacha's rates are
  not shown during the next request.
- Describe rates as the published current-stage settings. The original note
  said rates were calculated from initial stock; the existing contract supplies
  stage-specific settings. The notice remains in the same layout with three
  items and requires Human copy review with the completed UI.

## Screen data inventory

All dynamic fields below are already available through
`@oripa/storefront-client` `2.0.0-alpha.42`, using `getGachaBySlug(slug)` and its
generated `GachaDetail`. Client/Testkit pins, Manifest, OpenAPI, API payloads,
and Platform are unchanged. No new Public Contract is required for this UI.

### Ordinary Gacha detail

| UI element | Required data | Type / shape | State dependency | Shared | Reason |
| --- | --- | --- | --- | --- | --- |
| 提供割合を見る link | `detail.slug` | string | Existing detail ready state | Rate-page return link | Encode a single route segment; place between notices and Prize lineup |
| Link placement | Existing detail notices and Prize lineup | Existing presentation sections | Notices may be absent | Detail only | Preserve the canonical section order without changing Draw controls |

### Prize rate page

| UI element | Required data | Type / shape | State dependency | Shared | Reason |
| --- | --- | --- | --- | --- | --- |
| Read target | Route `slug` | string | Loading, ready, not-found, error | Detail link | Read the selected public Gacha through the canonical Client |
| Return link | `detail.slug` | string | Ready | Detail link | Return to the canonical Gacha detail |
| Gacha title | `detail.title` | string | Ready | Detail | Identify the displayed Gacha |
| 総口数 | `detail.total_count` | integer | Ready | Detail | Show the returned total in Japanese number formatting with 口 |
| Published rate stage | `probability_stages[].is_current` | boolean in ordered stage array | Ready; no current stage shows information unavailable | Existing detail contract | Use only the stage selected by Backend; no count/date/stage-condition inference |
| Award rows | Current `rank_probabilities[]` | Array of `{ rank: { id, name }, total_ppm }` | Current stage present | Existing contract | Preserve returned row order; display the Rank name and Backend rate |
| Award identity | `rank_probabilities[].rank.id`, `ranks[].rank_id` | Opaque string identifiers | Award row | Detail Prize lineup | Join disclosed stock to the returned Rank; never guess matching names |
| 提供割合 | `rank_probabilities[].total_ppm` | Integer, 0–1,000,000 | Award row | Existing contract | Convert units to percent with four decimal places; do not calculate probabilities from inventory |
| Award stock disclosure | `ranks[].show_total_stock` | boolean | Award row; true permits disclosure | Detail Prize lineup | Respect the existing disclosure setting |
| Award 封入数 | `ranks[].total_stock` | integer or null | Disclosure true and value present; otherwise — | Existing contract | Display the returned total; no summing Prize counts or reversing percentages |
| Expandable Prize breakdown | `prizes[]` and each `rank_id`, `total_inventory` | Optional ordered array; opaque ID; integer count | Disclosure true and matching disclosed Prize entries | Detail Prize lineup | Show a native disclosure control only when its breakdown exists |
| Prize row identity | `prizes[].id` | Opaque string | Expanded breakdown | Detail Prize lineup | Stable rendering identity |
| Prize name | `prizes[].name` | string | Expanded breakdown | Detail Prize lineup | Identify each returned Prize; preserve collection order |
| Prize 封入数 | `prizes[].total_inventory` | integer | Expanded breakdown | Detail Prize lineup | Display each original count, including zero, without stock/eligibility decisions |
| Minimum-guarantee row | Current `minimum_guarantee.total_ppm`, `result_type`, optional `rank.name` | integer; `prize` or `point_back`; string | Positive returned guarantee rate | Existing contract | Display returned guarantee as a separate row; no implied Rank stock count |
| コイン還元 row | Current `point_back_total_ppm` | integer | Positive returned rate | Existing contract | Show a returned point-back allocation without creating purchase or exchange behavior |
| Information unavailable | No Backend-current stage or no returned rows | Absence of current stage / display rows | Ready | Rate page only | Avoid showing another stage's values or fabricated rates |
| Loading | Client read lifecycle | Presentation status | Loading | Existing loading component | Indicate that the public read is pending |
| Configuration unavailable | Provider configuration availability | boolean / null Client | Configuration unavailable | Existing provider | Safe unavailable message, no guessed endpoint |
| Not found | Existing typed Platform not-found result | Existing Problem Details | Not found | Existing catalog problem handling | Explain an unavailable/unpublished Gacha |
| Error and retry | Existing safe problem presentation and Client retry | Existing presentation type | Error | Existing catalog problem handling | Use safe error text and repeat the same public read |
| Page heading, table labels, units, notices | Static UI copy | strings | Heading always; table when rows exist | Existing theme | These require no Backend fields |
| Header / footer / navigation | Existing shared providers and shell | Unchanged | Existing Session rendering | All pages | Public rates do not derive eligibility from login state |

## Minimal Contract Data Candidate (proposal only)

No new Contract fields are proposed. The smallest *display dependency subset*
of the existing contract is:

```text
Gacha: slug, title, total_count
Current stage marker: probability_stages[].is_current
Current stage: rank_probabilities[].{rank.id, rank.name, total_ppm}
               minimum_guarantee.{total_ppm, result_type, rank?.name}
               point_back_total_ppm
Stock disclosure: ranks[].{rank_id, show_total_stock, total_stock}
Prize breakdown: prizes[].{id, rank_id, name, total_inventory}
```

This is an inventory for Human review, not a replacement response definition or
a Backend specification. Existing generated schemas remain authoritative.
`state`, `expires_at`, `as_of`, `remaining_seconds`, `remaining_label`, `eligible`,
`first_time_only`, `authenticated`, and `reason` are not additional dependencies
of the rate component. Shared navigation continues to use its existing Session
provider. Stage conditions, remaining inventory, sale timers, Draw eligibility,
and user-specific purchase data are not consumed to choose rates.

## Review limits

The public contract exposes Prize counts even when a Rank's total is hidden;
this UI suppresses that breakdown when `show_total_stock` is false, matching the
existing detail disclosure rule. The returned public percentages are still
displayed for those Ranks as specified by the canonical delivery; this change
does not create a new confidentiality rule or alter API exposure.

Comparison screenshots use fixed test fixtures; real preview rates use only
the actual Platform response. Fixtures and state overrides belong exclusively
to automated tests/browser verification, never a production switch or route.
No real Draw, Coin purchase, shipment, or Point exchange is part of layout
acceptance. Human should confirm notice copy and public disclosure presentation
before deciding whether to merge. Production activation is outside this change.

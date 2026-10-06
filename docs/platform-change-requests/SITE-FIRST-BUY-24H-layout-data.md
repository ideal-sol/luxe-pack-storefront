# First-buy 24-hour presentation capability gap

## Resolution — SF24H-20261005

Resolved by Platform PR #540 / REL-043 PR #541 and immutable alpha.43 Artifact
`11349442812`. The integration pins the exact published Client/Testkit and uses
`first_user_offer.state / expires_at / as_of` with product-level eligibility.
Display pricing is derived from existing grant/price fields; no additional
pricing contract is required. Qualification starts at first email verification.
The layout remains the exact PR #139 presentation source with minimal contract
and copy corrections; fixed fixtures remain Preview-only. No persistent popup
eligibility or once-per-member authority is implemented in the Storefront.

## Historical Phase 1 / 2 request

Status: recorded only. Phase 1 / 2; no Platform or Contract implementation.

The completed UI and all screen-by-screen display dependencies are recorded in
[the layout data inventory](../ui/first-buy-24h-data-inventory.md).
The minimal missing candidates are one authoritative offer display classification,
one active-only countdown display value, and a justified regular-price reference
for each discounted product where the existing products cannot establish it.
These are capabilities to discuss, not an endpoint or response schema.

The existing pinned Client and Testkit remain unchanged. The fixed layout samples
never become Platform responses, eligibility decisions, or payment input. Formal
timer, offer-start/consumption rules, and automatic once-per-member popup behavior
are deferred until after Human Source / Browser review.

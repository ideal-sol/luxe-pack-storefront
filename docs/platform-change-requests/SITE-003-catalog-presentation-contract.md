# SITE-003 catalog presentation contract gaps

## Available contract

MIG-061U `2.0.0-alpha.1` provides public gacha summaries, categories, tags,
banners, notices, and cursor metadata. SITE-003 uses those fields without adding
local business decisions.

## Decisions required from Platform

The current gacha summary has publication timestamps and raw total/remaining
counts but no explicit presentation status. Storefront therefore does not label a
card as upcoming, on sale, ended, or sold out. If those labels are required,
Platform should expose a canonical display status and its allowed label semantics.

The current list query supports cursor, category, and tag but no explicit sort or
featured filter. Storefront retains the backend's returned order. If marketing
placement or user-selectable sorting is required, Platform should define stable
query values and ordering guarantees.

The banner contract permits a general string link. Platform should confirm the
allowed internal/external URL policy. SITE-003 renders same-site paths and HTTPS
links only and otherwise keeps the banner non-interactive.

## Acceptance for a later contract task

- OpenAPI and Storefront Client expose any approved additive fields/queries.
- Testkit includes public-safe fixtures for each new enum or ordering behavior.
- Storefront does not derive status from timestamps or remaining counts.
- Preview asset and link delivery are verified through the approved same-Origin
  route before live connectivity is reported.

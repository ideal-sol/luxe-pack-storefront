# SITE-022 Footer page navigation contract

## Status

**Resolved by MIG-062O Production Artifact `2.0.0-alpha.11` on 2026-08-14.**

MIG-062O adds generated `listFooterPages()` to the Content Client. Its anonymous
safe-read response contains only currently public Static Pages with Footer display
enabled, in Backend-authoritative order. Each item supplies the public ID, slug,
and title required by the existing `/pages/[slug]` route. The operation publishes
the public 60-second cache policy and standard Problem Details boundary.

The Testkit adds `PUBLIC_FOOTER_PAGES_FIXTURE`, including the canonical returned
collection and excluded Footer-off／outside-publication-period cases. SITE-022 now
renders only returned items, supports a successful empty collection, and contains
configuration or read failures without breaking the rest of the Footer.

Resolution evidence:

- Artifact: MIG-062O `2.0.0-alpha.11`
- Source Commit: `367b82bd4c21178a4e1d041c21b5967971d18a71`
- Manifest SHA-256: `7a26635e57a8ecf15cf0c5d4fbcd214a0f9f022fbfc3eb9c31977a05f431eb53`
- Public OpenAPI SHA-256: `cb00709ad49fb11dd802530d41ac056845730dd3b96ff3613ec36feae1379816`

## Historical blocker record

**Originally blocked on a missing Public Content Navigation Contract as of 2026-08-12.**

MIG-062G Production Artifact `2.0.0-alpha.9` can read one published Static Page
when the Storefront already knows its slug. It cannot list published Pages or
identify which Pages the administration UI assigned to the 「フッターメニュー」
placement. The Storefront therefore cannot replace the current fixed
`INFORMATION` links without inventing a slug list, Category／Placement identifier,
publication decision, or ordering rule.

No Footer, route, Platform adapter, fixture, management setting, or Platform data
was changed during this audit.

## Task context

- Storefront Task: `SITE-022`
- Issue: `#42`
- Risk: MEDIUM (`R2`)
- Base SHA: `20759b799584ab7a3d95f098d23b97f087f86b6b`
- Branch: `site/SITE-022-footer-page-navigation`
- Artifact: MIG-062G `2.0.0-alpha.9`
- Artifact source Commit: `36220b5c08820741b4763363a7e86c18274b9688`

The Repository Artifact verifier passed before the Contract audit. The audit used
the Manifest, Public OpenAPI, generated Storefront Client, Site Schema, and
Storefront Testkit as authorities. SITE-021 remains separately blocked and was
not inspected or modified.

## Available Static Page contract

The Public OpenAPI and generated Client provide only the existing single-item
read:

- the caller supplies a known public slug;
- the Backend returns that published Page or Problem Details;
- generated Page fields include a public identifier, slug, title, canonical HTML
  body, checksum, legal-page flag, and publication timestamps;
- the operation is an anonymous safe read with the published public 60-second
  cache policy;
- the existing `/pages/[slug]` Storefront route can continue using this contract.

This contract is suitable for rendering a Page after navigation. It is not a
navigation discovery contract.

## Missing contract

The alpha.9 Public OpenAPI contains no operation for a Static Page collection or
navigation placement. The generated Content Client exposes `getStaticPage(slug)`
but no Page-list or Footer-navigation method. Generated schemas do not expose a
Page Category, Placement, navigation label, or Backend-authoritative order.

Consequently, the Storefront cannot determine:

- which published Static Pages belong to 「フッターメニュー」;
- whether that management label maps to a stable machine-readable Placement;
- the Footer link label when it differs from the Page title;
- the Backend-authoritative order;
- whether an entry was removed, unpublished, or is outside its publication
  window;
- whether no links is a successful empty navigation or an unavailable navigation
  response.

The Site Schema package contains no relevant Content Navigation definition. The
alpha.9 Testkit publishes Banner and Notice content fixtures, but no Static Page
navigation fixture, empty collection, unpublished-Page case, or placement/order
assertion.

The current `SiteFooter` consumes a Repository-local fixed three-link array. That
historical behavior demonstrates the gap; it must not be extended, filtered, or
reordered locally to satisfy the new specification.

## Required Public contract

The Platform should publish a generated, anonymous read contract for Static Page
navigation. Without prescribing an endpoint name, response type name, database
model, or administration implementation, the contract must allow the Storefront
to obtain only the currently published Pages assigned by management to the
「フッターメニュー」 placement.

Each returned navigation entry must provide:

- a Backend-selected link label or canonical Page title;
- the public Page slug or public identifier needed for the existing
  `/pages/[slug]` route boundary;
- Backend-authoritative display order;
- an explicit guarantee that the Page is currently public and belongs to the
  requested／defined Footer placement.

The Storefront must not need to know or hard-code a Page Category database ID,
Placement database ID, slug allow-list, publication timestamp rule, or sort
algorithm. Non-public Pages and Pages assigned to other placements must not be
returned as Footer navigation entries.

## Error and cache contract

The published contract must distinguish:

- a successful navigation collection with multiple entries;
- a successful empty collection;
- temporary Content Navigation unavailability;
- invalid or unavailable placement input, if placement is caller-selectable;
- rate limiting and forward-compatible generic Problem Details.

It must define the public cache duration and invalidation／freshness behavior when
an administrator changes membership, order, label, publication state, or Page
slug. A stale cache must not require the Storefront to infer whether a Page is
still public. Unknown Problem Details remain generic and must not be parsed into
navigation rules.

## Storefront behavior after resolution

Once a versioned Artifact provides the contract, the Storefront will:

- replace only Footer `INFORMATION` link generation with the canonical returned
  entries;
- preserve Backend order without local sorting or filtering;
- link through the existing `/pages/[slug]` boundary;
- render the same hierarchy on Desktop and Mobile;
- render no invented links for a successful empty collection;
- contain Loading／Error so Brand, Explore, Account, Footer structure, and page
  content remain usable;
- avoid direct `/api/v2` calls and local response types.

The existing Brand, Explore, and Account regions are outside this change.

## Testkit acceptance

The resolved Testkit should provide public-safe generated fixtures and Client
coverage for:

- multiple published Footer Pages in explicit Backend order;
- a successful empty Footer navigation;
- an unpublished Page excluded from the result;
- a published Page assigned to another placement excluded from the result;
- canonical label/title and slug/public identifier values;
- typed／generic error handling and the published cache metadata.

Fixtures must not contain production content, credentials, Tokens, Cookies, PII,
or internal database identifiers that the Public consumer is not meant to use.

## Resume criteria

SITE-022 may resume when an integrity-verifiable Production Artifact publishes
the Page navigation method, generated fields, cache/error boundary, and Testkit
coverage above. Until then, Issue #42, the Task branch, Worktree, Policy, and this
uncommitted Change Request remain the blocked-task record.

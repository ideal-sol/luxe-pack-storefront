# Luxe Pack Storefront

Independent customer-facing Storefront for Luxe Pack. The application uses Next.js App Router and keeps Platform communication behind the version-pinned `@oripa/storefront-client` boundary.

## Local commands

```text
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm validate
```

Required runtime versions are Node `22.22.3` and pnpm `10.12.1`.

## Platform client

The current MIG-062W Production artifacts are vendored at
`vendor/oripa/MIG-062W` and fixed to version `2.0.0-alpha.20` using
Repository-relative `file:` dependencies. Historical bundles remain immutable. Run
`pnpm artifact:check` to verify the Manifest, SHA-256 values, package identities,
archive paths, Lifecycle Script boundary, and absence of server-specific file
dependencies.

Browser authentication is exposed only through `src/lib/platform`. The canonical
client owns endpoint paths, cookie credentials, CSRF initialization, protocol
headers, generated request/response types, and Problem Details parsing. React
Components do not reproduce those details and never persist authentication values.

Set the public `NEXT_PUBLIC_PLATFORM_API_BASE_URL` only in an approved runtime.
Without it, the build still succeeds and the UI reports that Platform
configuration is unavailable. MIG-061Z established the Platform Public Origin
and same-Origin API proxy; deploying the Storefront application at that Origin
is handled by the separate Preview deployment runbook.

Footer `INFORMATION` links use the generated public Content
`listFooterPages()` contract. The Backend returns only currently public Pages
enabled for the Footer in its canonical order; the Storefront uses returned
titles and slugs without filtering, sorting, or maintaining a local Footer list.
An empty collection or read failure leaves the rest of the Footer usable.

## Public catalog

Public home and gacha-list reads use the same pinned browser transport through the
`src/lib/platform` Public Catalog adapter. The UI consumes only generated Client
types for banners, categories, gacha summaries, cursor metadata, and notice
summaries. Catalog loading does not wait for Session resolution. Missing runtime
configuration is rendered as an explicit state and does not fall back to invented
data.

MIG-062G adds Backend-authoritative Catalog presentation to every returned Gacha.
Cards retain ended, sold-out, and authenticated-ineligible entries in Backend
order, render the generated sale/eligibility presentation, and use only generated
display flags to omit Point, total-count, and Draw-count facts. The Frontend does
not derive state from dates, remaining units, audience, or Session fields.

`/gachas/[slug]` combines the canonical detail read with MIG-061Y
`getGachaPresentation`. The returned sale state, eligibility, allowed draw
counts, daily limit, reason, and CTA state are authoritative. SITE-004 does not
perform a Draw mutation or infer Point insufficiency.

SITE-005 connects that canonical CTA to the generated Browser-safe Draw Client.
The Client owns Cookie/CSRF protocol handling, while the UI owns only a transient
canonical Idempotency Key for one operation. `/draws/[drawRequestId]/result`
always reloads the completed response with `getDrawRequest`; it does not resubmit
the mutation or optimistically update Point and Prize state.

`/mypage/draws` uses the same generated Draw Client for the read-only Current
User Gacha History contract. Each row renders the returned Historical Gacha
title／presentation image, occurred time, requested／executed counts, and
Backend status label. Pages are appended in returned order and the opaque
cursor is passed back unchanged; Current Gacha data is never used to rewrite a
historical row.

`/mypage/line` combines the existing canonical External Identity collection with
MIG-062W `getLineFriendState`. The Backend-returned status, LINE-user decision,
and primary action presentation remain authoritative. The Storefront does not
derive eligibility, status labels, or actions from identity or friendship flags;
unknown actions and cross-contract inconsistencies fail closed without a fallback
journey.

MIG-062J keeps large Draw options fully Backend-authoritative. The detail UI
renders every returned `allowed_draw_counts` entry, including optional 100／1000,
without comparing it to remaining units. The mutation sends the selected
requested count unchanged; result presentation uses canonical `executed_count`
and does not assume it equals `requested_count`.

## Prize inventory

`/mypage/prizes` uses generated `presentation` and `allowed_actions` fields.
Selection and bulk action visibility follow Backend-returned action states.
SITE-012 connects those actions to the MIG-062E Browser-safe Prize fulfillment
client for address, shipping, and point-exchange operations. Caller Idempotency
Keys, typed problems, and canonical read reconciliation are used without
inferring actions from status/dates or optimistically updating Prize/Point state.

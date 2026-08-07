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

## Authentication client

The current MIG-061Y artifacts are vendored at `vendor/oripa/MIG-061Y` and fixed
to version `2.0.0-alpha.2` using Repository-relative `file:` dependencies. The
historical MIG-061U bundle remains immutable. Run
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
remains outside this Repository task.

## Public catalog

Public home and gacha-list reads use the same pinned browser transport through the
`src/lib/platform` Public Catalog adapter. The UI consumes only generated Client
types for banners, categories, gacha summaries, cursor metadata, and notice
summaries. Catalog loading does not wait for Session resolution. Missing runtime
configuration is rendered as an explicit state and does not fall back to invented
data.

`/gachas/[slug]` combines the canonical detail read with MIG-061Y
`getGachaPresentation`. The returned sale state, eligibility, allowed draw
counts, daily limit, reason, and CTA state are authoritative. SITE-004 does not
perform a Draw mutation or infer Point insufficiency.

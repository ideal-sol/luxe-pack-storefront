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

MIG-061U artifacts are vendored at `vendor/oripa/MIG-061U` and fixed to version
`2.0.0-alpha.1` using Repository-relative `file:` dependencies. Run
`pnpm artifact:check` to verify the Manifest, SHA-256 values, package identities,
archive paths, Lifecycle Script boundary, and absence of server-specific file
dependencies.

Browser authentication is exposed only through `src/lib/platform`. The canonical
client owns endpoint paths, cookie credentials, CSRF initialization, protocol
headers, generated request/response types, and Problem Details parsing. React
Components do not reproduce those details and never persist authentication values.

Set the public `NEXT_PUBLIC_PLATFORM_API_BASE_URL` only in an approved runtime.
Without it, the build still succeeds and the UI reports that authentication
configuration is unavailable. Live Preview connectivity is intentionally pending
the contract in `docs/platform-change-requests/SITE-002-preview-auth-connectivity.md`.

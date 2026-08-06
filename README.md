# Luxe Pack Storefront

Independent customer-facing Storefront for Luxe Pack. The application uses Next.js App Router and keeps Platform communication behind the future `@oripa/storefront-client` integration boundary.

## Local commands

```text
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm validate
```

Required runtime versions are Node `22.22.3` and pnpm `10.12.1`. SITE-001 contains no real Platform API integration and builds without environment values.

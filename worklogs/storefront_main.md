# Storefront worklog

## SITE-001 — Storefront foundation and common layout

- Issue: `#1`
- Risk: MEDIUM (`R2`)
- Base SHA: `4c3291e0c19469c83642b47dca91f0300f90f3e4`
- Branch: `site/SITE-001-storefront-foundation`

### Purpose

Create an independent Next.js foundation and shared responsive shell that later Storefront Tasks can extend without crossing the Platform business-authority boundary.

### Changes

- Added version-pinned Next.js, TypeScript, pnpm, Tailwind, ESLint, and Vitest foundation.
- Added Storefront-specific governance, routes, common layout, shared UI states, documentation, policy checks, and five CI gates.
- Reserved the Platform Client adapter boundary without installing or calling it.

### Verification

- `pnpm policy:check`: PASS
- `pnpm security:check`: PASS
- `pnpm audit --audit-level high`: PASS, no known vulnerabilities
- `pnpm lint`: PASS
- `pnpm typecheck`: PASS
- `pnpm test`: PASS, 4 files / 9 tests
- `pnpm build`: PASS, all required routes generated
- HTTP route smoke: PASS, 14 routes returned 200

Browser E2E and pixel-perfect visual comparison were not run and are not SITE-001 acceptance requirements.

### Not implemented

Real API integration, authentication behavior, pack data, point behavior, draw behavior, payment, customer assets, and production infrastructure.

### Next task

SITE-002 confirms the published Platform contracts and introduces the real `@oripa/storefront-client` boundary without direct Component requests.

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

## SITE-002 — Authentication client integration and session foundation

- Issue: `#3`
- Risk: HIGH (`R3`)
- Base SHA: `8bcfd30860081d75598eae4ba021931ac096467f`
- Branch: `site/SITE-002-authentication-client-integration`

### Purpose

Vendor and verify the MIG-061U authentication artifacts, then establish the
canonical browser authentication and session boundary without changing Platform
or implementing live Preview routing.

### Changes

- Pinned Client, Testkit, and Site Schema `2.0.0-alpha.1` tarballs using relative
  file dependencies and added repeatable Manifest/archive integrity checks.
- Added runtime configuration, browser Auth Adapter, typed Problem presentation,
  Session Provider, login, registration, logout, and email-verification UI.
- Connected Header authentication controls and kept Point balance unconnected.
- Added deterministic Testkit contract coverage, boundary checks, clean-install
  CI, and the Preview connectivity Platform Change Request.

### Verification

- Artifact Manifest, five formal SHA-256 values, and bundled `SHA256SUMS`: PASS
- Vendor archive identity, path, content, and Lifecycle Script checks: PASS
- `pnpm policy:check`: PASS
- `pnpm auth-boundary:check`: PASS
- `pnpm security:check`: PASS
- `pnpm audit --audit-level high`: PASS, no known vulnerabilities
- `pnpm lint`: PASS
- `pnpm typecheck`: PASS
- `pnpm test`: PASS, 6 files / 24 tests
- `pnpm build`: PASS
- Repository-external clean install, lint, typecheck, test, and build: PASS

GitHub results are fixed to the PR Head in the machine-readable self-review.
Live Preview authentication was not run because the Public route, Origin, and
same-Origin proxy contract remains pending.

### Not implemented

Live Preview authentication, Public route/proxy infrastructure, LINE Login, SMS,
password reset, Point, Draw, Prize, shipping, payment, or production switching.

### Next task

SITE-003 should consume only resolved Public contracts and retain the Session and
Platform boundaries. Preview authentication remains a separate Platform
connectivity task.

## SITE-003 — Public home and gacha catalog

- Issue: `#5`
- Pull Request: `#6`
- Risk: MEDIUM (`R2`)
- Base SHA: `6261a8a5f594102e898f77c7d0e05d58218298d7`
- Branch: `site/SITE-003-public-home-catalog`

### Purpose

Connect the public home and gacha list to the pinned Public Contract while keeping
public reads independent from Session and preserving the SITE-002 boundary.

### Changes

- Added a canonical Public Catalog adapter and Provider using the existing browser transport.
- Added banner, category, gacha-card, notice, cursor, typed state, and asset-fallback UI.
- Rebuilt `/` and `/gachas` as responsive public data surfaces without implementing detail or mutations.
- Added Testkit contract/component coverage, current context, design notes, and a catalog presentation Change Request.

### Verification

- Artifact integrity: PASS
- Policy, authentication boundary, and catalog boundary checks: PASS
- Secret／PII lightweight scan: PASS
- Dependency audit at high severity: PASS, no known vulnerabilities
- `pnpm lint`: PASS
- `pnpm typecheck`: PASS
- `pnpm test`: PASS, 8 files／36 tests
- `pnpm build`: PASS

Final Clean Directory and GitHub results are fixed to the SITE-003 PR evidence.
Live Preview communication, Browser E2E, and pixel-perfect visual comparison are
not performed by this Task.

### Not implemented

Gacha detail, Draw, Point, member pages, live Preview routing, explicit sales-state
derivation, sorting without Contract, and production infrastructure.

### Next task

SITE-004 should reuse the public adapter, cards, asset fallback, and existing
Session boundary. Pending Platform contracts remain authoritative blockers for
Point, user history, Preview connectivity, and any explicit catalog status/order.

## SITE-009 — Notices and static pages

- Issue: `#10`
- Risk: MEDIUM (`R2`)
- Base SHA: `ec8c9b9c45447baba693e48707a5fe207975ccd5`
- Branch: `site/SITE-009-notices-static-pages`

### Purpose

Replace the notice and static-page placeholders with the pinned public Content
contract while SITE-004 remains independently held on its missing eligibility
contract.

### Changes

- Extended the existing public adapter with canonical notice-detail and
  static-page reads.
- Implemented the notice cursor list, notice detail, and responsive long-form
  document routes with explicit loading, empty, not-found, typed-error, and
  configuration states.
- Added an allowlist HTML sanitizer boundary, safe external-link attributes,
  centralized existing Footer page links, deterministic Contract/UI tests, and a
  content boundary CI check.

### Not implemented

Live Preview communication, Browser E2E, invented static content or slugs, SEO
fields absent from the Contract, and SITE-004 gacha-detail behavior.

### Verification

- Artifact, Policy, Auth, Catalog, Content boundary, and Secret checks: PASS
- Dependency audit at high severity: PASS, no known vulnerabilities
- `pnpm lint`: PASS
- `pnpm typecheck`: PASS
- `pnpm test`: PASS, 9 files／45 tests
- `pnpm build`: PASS

Browser E2E and live Preview communication were not run. Fixed-head GitHub
results and Self-review are recorded on the SITE-009 Pull Request.

### Parallel task state

SITE-004 Issue `#9`, Policy, Branch, Worktree, and uncommitted Platform Change
Request remain held and unchanged. Its sale state, eligibility, allowed draw
counts, daily remaining count, and ineligible reason remain Pending Contract.

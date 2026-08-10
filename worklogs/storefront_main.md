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

## SITE-004 — Gacha detail and draw eligibility

- Issue: `#9`
- Risk: MEDIUM (`R2`)
- Original Base SHA: `ec8c9b9c45447baba693e48707a5fe207975ccd5`
- Resumed Base SHA: `093e662d03da61ba2d5955ab00c87056eb80b5b8`
- Branch: `site/SITE-004-gacha-detail`

### Purpose

Resume the preserved SITE-004 task after MIG-061Y resolved its core presentation
contract, and implement public detail plus Backend-authoritative eligibility and
draw-option presentation without starting the Draw mutation.

### Changes

- Preserved the historical Change Request, fast-forwarded the existing branch,
  and upgraded the pinned Client, Testkit, and Site Schema packages to the
  verified MIG-061Y `2.0.0-alpha.2` bundle.
- Connected `getGachaBySlug` and `getGachaPresentation` behind the existing
  Platform adapter.
- Implemented responsive main detail, returned facts and progress, notices,
  ordered rank/prize grids, accessible prize modal, canonical sale/eligibility
  states, daily-limit presentation, returned-count selection, and sticky CTA.
- Added Artifact/Contract/UI regression and boundary checks. The boundary rejects
  local sale, eligibility, daily-limit, allowed-count, and Point-insufficiency
  rules.

### Not implemented

Draw mutation, Idempotency, Point consumption or insufficiency inference, result
presentation, animation, Storefront Preview deployment, or synthetic Catalog
data. SITE-007 remains held in its separate worktree and Policy.

### Next task

SITE-005 may consume the selected count and CTA boundary, but must use the
canonical Backend mutation for affordability, execution, and result semantics.

## SITE-007 — Prize inventory and selection UI

- Issue: `#12`
- Risk: MEDIUM (`R2`)
- Original Base SHA: `093e662d03da61ba2d5955ab00c87056eb80b5b8`
- Resumed Base SHA: `6a2e743cc8c390a2a335e83643c52499c032d666`
- Branch: `site/SITE-007-prize-inventory`

### Purpose

Resume the preserved Prize inventory task after MIG-062A published typed
presentation and Backend-authoritative action state, without beginning shipping
or point-exchange mutations.

### Changes

- Preserved the historical Change Request, fast-forwarded the existing branch,
  and pinned the verified MIG-062A `2.0.0-alpha.4` bundle.
- Added a narrow `listPrizes` / `getPrize` adapter and authenticated responsive
  inventory with cursor continuation, generated status/rank/facts, and fallback
  images.
- Added individual, select-all, and reset controls based only on
  `allowed_actions.selection`, plus a non-mutating mobile bulk tray derived only
  from Backend-returned shipping and point-exchange action states.
- Added Artifact, compatibility, Contract, UI, and boundary coverage.

### Not implemented

Shipping, point-exchange, address, or Prize-state mutation; inferred status
groups; automatic expiry; Storefront Preview deployment; or live authenticated
Preview verification.

### Next task

Later Prize mutation work must revalidate selections in Backend and resolve
status grouping, expiry lifecycle, group compatibility, address, Idempotency, and
stale-action errors. SITE-005 remains independent.

## SITE-010 — Visual and responsive convergence

- Issue: `#16`
- Risk: LOW–MEDIUM (`R2`)
- Base SHA: `9b5eb72d545c95a6cfa3462f500cb4bdeb9fd76c`
- Branch: `site/SITE-010-visual-responsive-convergence`

### Purpose

Converge the already implemented Storefront routes on the verified ORIPAONE
visual and responsive observations without adding APIs, changing route meaning,
or modifying Platform-backed state and business decisions.

### Changes

- Added small shared presentation tokens for the 800-pixel reading width, card
  and control radii, and keyboard focus.
- Converged Header height, Home banner/category rails, mobile/desktop gacha grid,
  Auth form width, Content documents, Gacha Detail sticky/modal treatment, and
  Prize inventory cards/tray.
- Contained horizontal scrolling at banner, category, filter, Draw-option, and
  document-table boundaries while preventing page-level horizontal overflow.
- Added a targeted stylesheet regression for reading width, grid breakpoints,
  overflow containment, focus targets, and mobile tray stacking.

### Boundaries

Platform adapters, contracts, Session behavior, routes, sale/eligibility logic,
allowed draw counts, and Prize actions are unchanged. SITE-005 remains in its
separate Issue, Policy, Branch, and Worktree and is not part of this change.

## SITE-006 — My page top and member navigation

- Issue: `#18`
- Risk: MEDIUM (`R2`)
- Base SHA: `849effc27dae6f6f8576ffb2337646bfa798e4c5`
- Branch: `site/SITE-006-mypage-top`

### Purpose

Replace the `/mypage` login-required placeholder with a Session-backed member
hub that reuses the current member routes and SITE-010 visual rhythm without
inventing Profile, Point, or membership contracts.

### Changes

- Added an authenticated one-column member dashboard with Session verification
  and account-state summary.
- Centralized My Page shortcuts, account navigation, and support navigation in
  `src/lib/routes/navigation.ts` and reused them in the screen.
- Added points, draw history, Prize inventory, LINE, notices, guide, terms, and
  privacy navigation plus logout through the existing Session boundary.
- Added Targeted coverage for authenticated, loading, unauthenticated, logout,
  central Route reuse, Mobile Navigation, and excluded unconfirmed features.

### Boundaries

No Profile Change Request is needed for the implemented scope. Nickname, Avatar,
Rank, Point balance, Premium Plan, Jackpot, Coupon, invitation, SMS, and Profile
showcase remain absent. SITE-005 remains independently held on its Platform
Contract and was not changed.

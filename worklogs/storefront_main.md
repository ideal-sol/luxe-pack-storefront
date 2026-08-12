# Storefront worklog

## SITE-017 — Preview Browser runtime diagnosis

- Issue: `#32`
- Risk: MEDIUM (`R2`)
- Base SHA: `09407fe81b9de9205f2de1aab613cb891ce0569c`
- Branch: `site/SITE-017-preview-browser-runtime-diagnosis`

### Purpose

Reproduce the user-observed Preview failure in a real Browser and explain why
the SITE-016 Node Client diagnosis succeeded.

### Result

- Chromium reproduced every public route's transport failure at 1280x720 and
  390x844 without issuing a Public API network request.
- The native `window.fetch` receiver was not preserved by the generated Client's
  stored-function call; Chrome rejected it with `Illegal invocation`.
- The shared Storefront Browser transport now supplies a receiver-safe function,
  preserving the canonical Client, same-Origin configuration, and adapters.
- Added a receiver-sensitive regression test. No fixture, Platform, Nginx,
  public data, or SITE-014 state changed.

### Expected Browser state after deployment

Home and Catalog render three cards, Notices renders its normal empty state, and
Terms renders the known Platform 404 as not found. Hydration and page runtime
errors remain absent. After deployment, one approved Preview test-user Login
journey verifies that the shared receiver fix also restores Session／CSRF／Login
transport; no credential or protocol value is retained.

## SITE-016 — Preview public data diagnosis

- Issue: `#30`
- Risk: MEDIUM (`R2`)
- Base SHA: `1098cc3e0f5cd77b0a4043bf62f3aeef3c67f984`
- Branch: `site/SITE-016-preview-public-data-diagnosis`

### Purpose

Classify the Preview public-screen failure report through the canonical alpha.8
Client without changing Visuals, fixtures, Platform data, or state.

### Result

- Home: banners/notices are valid empty collections; categories and gachas have
  Client-accepted display data.
- Gacha catalog: valid, non-empty Client response.
- Notices: valid empty Client response.
- Terms: typed Platform Problem Details with HTTP 404; canonical content is not
  published in Preview.
- Same-Origin runtime configuration, transport, Client response handling, and
  Storefront adapters succeeded. No Storefront defect was reproduced.

### Changes

- Added a non-mutating, response-body-free Preview Client diagnosis command.
- Added empty public-content Contract regression coverage.
- Recorded the Platform static-content requirement without adding fixtures or
  changing presentation behavior.

### Not implemented

Visual changes, synthetic content, Platform data changes, authenticated actions,
and SITE-014 changes.

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

## SITE-011 — LINE account link UI

- Issue: `#20`
- Risk: MEDIUM (`R2`)
- Base SHA: `e8cef8b68ecd3c1e3501ea8d56081fa264abb335`
- Branch: `site/SITE-011-line-account-link`

### Purpose

Replace `/mypage/line` with a Session-gated External Identity screen that reads
the canonical link state and starts a Platform-owned LINE authorization
transaction without recreating OAuth or eligibility rules.

### Changes

- Added an alpha.4 External Identity adapter and runtime Provider around the
  generated `listExternalIdentities` and `startLineIdentityLink` methods.
- Added unlinked, linked, loading, typed error, configuration unavailable, and
  login-required UI using the existing My Page route and common state treatment.
- Added Testkit/Component contract coverage and a LINE-specific boundary check
  that rejects direct API calls, browser credential storage, protocol details,
  and Component-owned callback parsing.
- Recorded friend state and unlink orchestration gaps in the SITE-011 Platform
  Change Request instead of deriving either from identity presence.

### Boundaries

The Storefront follows only the returned authorization URL and supplies the
generated local return path. OAuth code/state, provider tokens, Cookie/CSRF
details, callback verification, friend state, and recent-authentication
enforcement are not implemented in Components. Real external LINE authentication
remains untested. SITE-005 is unchanged.

## SITE-005 — Gacha Draw execution and result

- Issue: `#15`
- Risk: HIGH (`R3`)
- Original Base SHA: `9b5eb72d545c95a6cfa3462f500cb4bdeb9fd76c`
- Resumed Base SHA: `e6e30eaa37aacb7df98663ecc70eb6422989b9d5`
- Branch: `site/SITE-005-gacha-draw-execution`

### Purpose

Resume the preserved Draw task after MIG-062C resolved the Browser CSRF and typed
Draw-error blockers, then connect SITE-004's canonical selection to execution and
reload-safe result presentation.

### Changes

- Verified and pinned MIG-062C `2.0.0-alpha.6` without adopting alpha.5 or
  modifying earlier bundles.
- Added the generated Browser Draw adapter, canonical Idempotency helper,
  confirmation and double-submit boundary, generated typed-error presentation,
  and safe unknown-error fallback.
- Added `/draws/[drawRequestId]/result`, which retrieves the completed response
  through `getDrawRequest` on every mount and never submits a Draw.
- Added Contract, Component, recovery, Artifact, compatibility, and boundary
  coverage without Frontend sale, eligibility, Point, inventory, or award rules.

### Not implemented

Synthetic Preview data, live Draw E2E, animation, Header Point updates, Draw
history listing, or optimistic Point/Prize state. The Preview Catalog currently
has no public Gacha suitable for a safe Draw test.

## SITE-013 — Storefront Preview deployment

- Issue: `#24`
- Risk: HIGH (`R3`)
- Base SHA: `d24c6d8992d2eed296e58ebc31845b006645db43`
- Branch: `site/SITE-013-preview-deployment`

### Purpose

Deploy the reviewed Storefront production build to `test.luxe-pack.biz` while
preserving the MIG-061Z Public API proxy, TLS, Admin API boundary, production
Storefront, V1, and Platform Repository.

### Changes

- Added a non-mutating HTTPS smoke tool for public/member shells, Public API
  reads, the Admin boundary, redirect, and production-origin non-impact.
- Added the Preview release layout, root-owned public environment file,
  localhost-only systemd service, minimal Nginx change, Backup, and rollback
  runbook.
- Defined the same-Origin `/api/v2` build/runtime configuration without adding
  Platform URLs, Cookie details, or secrets to Components.

### Boundaries

SITE-012 remains independently held on its Browser-safe fulfillment and typed
Problem Contract. Preview smoke performs no Login, Draw, Shipping, Point
Exchange, or synthetic-data mutation. Responsive Browser review remains a
separate manual verification when no Browser runner is available.

## SITE-012 — Prize shipping and point exchange (resumed)

- Issue: `#23`
- Risk: HIGH (`R3`)
- Original Base: `d24c6d8992d2eed296e58ebc31845b006645db43`
- Resumed Base: `aa7acd20feef3ca85812048193bb6d2cd0c5bd68`
- Branch: `site/SITE-012-prize-fulfillment`

### Changes

- Preserved the held Change Request and fast-forwarded the existing branch and
  Policy to the resumed Base without a merge commit, rebase, or force push.
- Verified the MIG-062E Manifest, SHA256SUMS, package archives, and Public
  OpenAPI before pinning Production dependencies to `2.0.0-alpha.8`. The alpha.6
  vendor remains unchanged and alpha.7 was not introduced.
- Connected the existing `/mypage/prizes` selection UI to generated Browser-safe
  address, point-exchange, and shipping methods.
- Retained one caller Idempotency Key for a same-operation retry, suppressed
  duplicate submission, used generated typed fulfillment problems, and
  reconciled successful mutations through canonical Prize, Shipping, and Address
  reads.
- Address update/delete are not automatically retried. Uncertain transport
  results are checked with the relevant canonical Address read before the UI
  decides whether the requested state is present.

### Boundaries

The Frontend does not read Cookie or CSRF values, infer fulfillment actions from
status/deadline/points, update Prize or Point state optimistically, or parse an
unknown Backend detail string. Canonical status grouping and expiry lifecycle
remain Pending Contracts.

## SITE-015 — Storefront Preview release refresh

- Issue: `#28`
- Risk: HIGH (`R3`)
- Base and deployment target: `980985099fe5a1612b9da5a61b73b371a9b7b864`
- Branch: `site/SITE-015-preview-release-refresh`

### Purpose and boundary

Refresh the existing Preview application to the SITE-012 merged release through
the established immutable-release/current-symlink process. The refresh changes
only the Next.js application release and restarts only the existing Preview
service. It does not modify Nginx, `/api/v2`, `/admin/api/`, TLS, DNS, production
Storefront, V1, Platform, or payment configuration.

The release is built with the existing public Preview environment after
MIG-062E alpha.8 integrity verification. Smoke covers public/member shells and
read-only API/Admin boundaries. Address registration, Shipping, Point Exchange,
and other state-changing authenticated operations are not exercised.

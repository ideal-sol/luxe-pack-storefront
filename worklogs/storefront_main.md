# Storefront worklog

## SITE-029 — LINE Friend State Integration

- Issue: `#57`
- Risk: MEDIUM (`R2`)
- Base SHA: `ff490da5ebaaefd748bba7f320688a99c19b0ec3`
- Branch: `site/SITE-029-line-friend-state-integration`

### Changes

- Verify and vendor immutable MIG-062W Production Artifact `2.0.0-alpha.20`,
  retaining historical Artifacts and confirming additive alpha.19 compatibility.
- Connect `/mypage/line` to generated `getLineFriendState` through the canonical,
  receiver-safe Identity Client boundary while preserving `listExternalIdentities`
  and `startLineIdentityLink`.
- Render Backend-authoritative status, LINE-user decision, and primary action
  presentation without deriving labels, eligibility, or actions from flags.
- Fail closed for unknown action codes, unsafe external schemes, and inconsistent
  Identity/Friend-State reads; no fallback action is invented.

### Not changed

LINE unlink, follow/unfollow, OAuth/callback/webhook/Provider configuration,
Platform/DB/Migration, Payment, Nginx/DNS/TLS/systemd, and historical Artifacts are
unchanged. Preview deployment remains separately authorized and read-only.

## SITE-028 — Current User Gacha History Integration

- Issue: `#55`
- Risk: MEDIUM (`R2`)
- Base SHA: `f5cd2c34de76434815fcd19ddb154bbf07d350d9`
- Branch: `site/SITE-028-current-user-gacha-history-integration`

### Changes

- Verify and vendor immutable MIG-062V Production Artifact `2.0.0-alpha.19`,
  retaining all historical Artifact directories and confirming byte-identical
  retention of the alpha.18 Point Client contract.
- Connect `/mypage/draws` to generated `listDrawHistory` through the canonical
  Browser Draw Client boundary.
- Render Historical Gacha title／presentation image, occurred time,
  requested／executed counts, and Backend-authoritative status label without
  inferring partial execution, lifecycle, or current presentation.
- Preserve returned stable order and append opaque-cursor continuation without
  sorting, decoding, or exposing the cursor.
- Cover loading, empty, error, authentication/session, equal/unequal counts,
  cursor, ordering, and desktop/mobile presentation with alpha.19 Testkit.

### Not changed

Draw Mutation, Point Mutation, Prize／Inventory Mutation, Payment, Platform/DB,
Nginx, production domain, V1, and historical Artifacts are unchanged. Preview
verification remains read-only.

## SITE-027 — Point Read Integration

- Issue: `#53`
- Risk: MEDIUM (`R2`)
- Base SHA: `b3c6fbb1e487388d337894003a82883d28948aab`
- Branch: `site/SITE-027-point-read-integration`

### Changes

- Verify and vendor immutable MIG-062U Production Artifact `2.0.0-alpha.18`,
  retaining all historical Artifact directories and confirming the retained
  MIG-062R product/eligibility contract.
- Share the generated canonical Wallet read across Header, `/points`, and
  `/mypage/points`; never calculate balance from Ledger entries.
- Render the canonical Point product collection with Backend order, audience,
  sale, eligibility, reason, and CTA presentation unchanged.
- Connect canonical Point history with signed deltas, occurred time, Backend
  reason labels, and opaque-cursor append in returned order.
- Add alpha.18 Testkit coverage for balances, products, eligibility, history,
  ordering, cursor, Session failures, cross-surface synchronization, and zero
  Payment mutations.

### Not changed

Point purchase, Point grant/debit, Payment, Platform/DB, Nginx, production domain,
V1, wrappers, token broker, and historical Artifacts are unchanged.

## SITE-026 — Point purchase page layout

- Issue: `#51`
- Risk: MEDIUM (`R2`)
- Base SHA: `c39f9d7e386997c05c797e68f1741482db85d3b6`
- Branch: `site/SITE-026-point-purchase-layout`

### Changes

- Replace the `/points` placeholder with the shared narrow Page layout and a
  responsive Point purchase presentation.
- Keep the current balance at the established pending value `--` behind a
  replaceable display component.
- Add accessible `すべてのユーザー`／`初回ユーザー` presentation tabs without
  implementing first-purchase, segment, eligibility, or purchase decisions.
- Add a future product grid/card shell while rendering only a neutral preparing
  state in Runtime; test-only fixtures verify one/multiple/long-content layout.
- Reuse the shared Header, Footer, Mobile Bottom Navigation, state presentation,
  content width, spacing, focus, and responsive tokens.

### Not changed

Production Artifact alpha.14, Platform/OpenAPI/DB, Point and Payment contracts,
Header balance, purchase mutation, infrastructure, and unrelated routes are
unchanged. No fictitious Runtime product or price is added.

## SITE-025 — Home top banner carousel

- Issue: `#49`
- Risk: MEDIUM (`R2`)
- Base SHA: `af7d49ed41e5c9512fe4233ef2eea28435420db7`
- Branch: `site/SITE-025-home-banner-carousel`

### Changes

- Validate and vendor immutable MIG-062P Production Artifact `2.0.0-alpha.14`
  while retaining every historical Artifact directory.
- Replace the Home Banner placeholder with the Backend-authoritative
  `listBanners` collection and preserve its returned membership and order.
- Render one Banner without redundant navigation and multiple Banners with a
  dependency-free scroll-snap carousel, explicit controls, indicators, and
  keyboard navigation.
- Keep the established empty state and isolate Banner read failures from other
  Home public data.
- Use canonical `image_url` and `link_url` values without inventing asset paths,
  destination routes, or publication decisions.

### Not changed

Platform data and publication rules, Catalog/Notice/Footer contracts, routes,
business decisions, infrastructure, and historical Artifacts are unchanged.

## SITE-022 — Footer page navigation

- Issue: `#42`
- Risk: MEDIUM (`R2`)
- Original Base SHA: `20759b799584ab7a3d95f098d23b97f087f86b6b`
- Resumed Base SHA: `834d094fc100783204c90a97d900efee8498f16f`
- Branch: `site/SITE-022-footer-page-navigation`

### Resolution

MIG-062O Production Artifact `2.0.0-alpha.11` resolves the Public Footer Page
navigation blocker with generated `listFooterPages` and a public-safe Testkit
fixture. The response contains only currently public, Footer-enabled Pages in
Backend order.

### Changes

- Add the immutable MIG-062O vendor bundle and pin all Production packages to
  alpha.11 without changing historical Artifacts.
- Replace SITE-024's temporary fixed Footer entries with returned Page titles and
  `/pages/[slug]` links.
- Preserve Backend membership and ordering without local filtering or sorting.
- Treat an empty collection as normal and contain configuration/read failures in
  the Information region.
- Preserve the historical SITE-022 Change Request and append its resolution.

### Not changed

Static Page body rendering, Footer Brand／Explore／Account regions, Platform data,
Content publication rules, and unrelated routes or Business Rules are unchanged.

## SITE-021 — 100／1000 Draw availability

- Issue: `#41`
- Risk: HIGH (`R3`)
- Base SHA: `20759b799584ab7a3d95f098d23b97f087f86b6b`
- Branch: `site/SITE-021-large-draw-availability`

### Resolution

MIG-062I／MIG-062J and Production Artifact `2.0.0-alpha.10` resolve the
Backend-managed large Draw Count blocker. `allowed_draw_counts` remains the sole
option source, and the Draw mutation remains authoritative for sale, audience,
eligibility, daily-limit, inventory, remaining, and Point validation.

### Changes

- Pin current Production packages and Public OpenAPI to MIG-062J alpha.10 while
  retaining every historical Artifact directory unchanged.
- Keep configured 100／1000 buttons visible when returned, even when remaining
  units are below the selected requested count.
- Send requested count unchanged and present canonical executed count from
  mutation/result recovery without local truncation.
- Add generated partial-remaining fixture regression for requested 1000,
  executed 900, sold-out completion, and same-key replay.
- Preserve the original Platform Change Request and append its resolution.

### Not changed

Idempotency ownership, duplicate-submit protection, Draw Result public-ID
recovery, Point/Prize calculations, Platform data, and unrelated Footer work are
unchanged.

## SITE-014 — Gacha Catalog display contract alignment

- Issue: `#27`
- Risk: MEDIUM (`R2`)
- Original Base SHA: `980985099fe5a1612b9da5a61b73b371a9b7b864`
- Resumed Base SHA: `fc3ef3473618c16d3f5fb016f771aae7c7f5edd2`
- Branch: `site/SITE-014-catalog-display-contract`

### Resolution

MIG-062G Production Artifact `2.0.0-alpha.9` resolves the historical Catalog
list presentation blocker. The existing list operation now returns
Backend-designated mixed sale states with generated user presentation and display
flags while preserving category, tag, opaque cursor, and Backend-stable order.

### Changes

- Pin all three Production packages and Public OpenAPI to MIG-062G alpha.9.
- Keep ended, sold-out, and authenticated-ineligible items returned by the
  Backend; do not post-filter or sort them.
- Render generated sale/eligibility/reason presentation.
- Use only Backend display flags to omit Point, total-count, and Draw-count facts.
- Preserve the original Change Request and append the MIG-062G resolution.
- Add Testkit coverage for all published mixed-state/anonymous/authenticated fixtures.

### Not changed

Detail/Draw eligibility semantics, Platform routes, Business Rules, Draw
Mutation, Preview data, and unrelated Visual QA remain unchanged.

## SITE-019 — Prize Inventory Preview Read diagnosis

- Issue: `#36`
- Risk: MEDIUM (`R2`)
- Base SHA: `b86e6af7ee7dfa8c6d1762b17fab30b437229ed6`
- Branch: `site/SITE-019-prize-inventory-read-diagnosis`

### Diagnosis

The authenticated Preview reproduced the Prize Inventory Error state on Desktop
and Mobile. Session reads remained HTTP 200, but the Prize request never reached
the network. The Prize-specific generated Browser Client received the native
`window.fetch` without the receiver-safe wrapper introduced for the shared
Browser transport, so Chrome rejected it before Platform communication.

A diagnostic receiver wrapper preserved the Window receiver without changing
the request. The canonical Prize read then returned HTTP 200 and the Client/UI
accepted the non-empty inventory, proving that Platform data, response decoding,
adapter presentation, and the Preview user Prize state were valid.

### Change

- Reuse the shared receiver-safe Browser fetch in the Prize Client factory.
- Add a receiver-sensitive empty-collection regression test.
- Do not change Platform paths, schemas, typed problems, fixtures, Prize action
  rules, or fulfillment mutations.

## SITE-018 — Authenticated My Page route Session continuity

- Issue: `#34`
- Risk: MEDIUM (`R2`)
- Base SHA: `0b3066242d3f23be4d64acc7c8a9193c75f420f9`
- Branch: `site/SITE-018-mypage-session-continuity`

### Diagnosis

An actual Preview Browser Login remained valid: Cookies were present, current
Session reads returned 200, the root Header stayed authenticated, and My Page,
Prize, and LINE routes rendered normally. Only Point-history and Draw-history
placeholders showed Login Required because they did so unconditionally without
reading Session state.

### Changes

- Made the shared authenticated placeholder guard consume the root Session.
- Loading no longer becomes unauthenticated; authenticated members see the
  existing neutral pending-content state, while anonymous／expired and error
  states remain distinct.
- Added focused coverage for loading, authenticated, anonymous, and unavailable
  configuration states.
- Did not implement or infer Point and Draw-history contracts.

### Browser acceptance

After Preview deployment, one Login must support client navigation and full
reloads across My Page, Point history, Draw history, Prize inventory, and LINE
routes at Desktop and Mobile without another Login.

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

## SITE-020 — Gacha Detail visual QA fix

- Issue: `#39`
- Risk: MEDIUM (`R2`)
- Base SHA: `ef325f0a06e14b374fda4c590720b7b102f77675`
- Branch: `site/SITE-020-gacha-detail-visual-qa-fix`

### Purpose

Resolve only the two Browser-confirmed Detail presentation defects: a
variable-length Rank label escaping its fixed circular badge, and the fixed Draw
tray obscuring Footer navigation and terminal content.

### Changes

- Make the existing Rank badge a bounded, wrapping pill and allow its adjacent
  heading row to wrap without overlap or horizontal overflow.
- Add Footer clearance only while a Gacha Draw tray exists, with separate
  Desktop and Mobile spacing that retains the Bottom Navigation and safe-area
  stack.
- Retain every existing Draw option, CTA, sale, eligibility, and Platform
  boundary without modification.

## SITE-030 — Coin Display / Expiring Balance Integration

- Issue: `#59`
- Risk: MEDIUM (`R2`)
- Base SHA: `9f42acd56dcfd3087ddc26d2abdc1699dd7e14f8`
- Branch: `site/SITE-030-coin-display-expiring-balance`

### Purpose and boundary

Adopt the immutable MIG-062Z `2.0.0-alpha.21` Artifact and expose its canonical
current-user Wallet total and expiry presentation. Header, Navigation, Point
pages, Gacha, and Draw use Coin terminology for users while `/points`, Point
TypeScript identifiers, generated operations, and response fields remain
unchanged.

The shared balance summary renders every Backend-returned
`expiring_within_7_days` bucket in order and formats `expires_at` in
`Asia/Tokyo`. It does not compare the current time, calculate seven days, filter
or aggregate buckets, rebuild total from paid/free values, or total Ledger
entries. Product cards use only canonical `grant.total_points` and omit the
paid/bonus breakdown. Backend title/reason strings receive a currency-word-only
presentation transform without mutating the canonical response.

## SITE-031 — Coin Terminology Completion — Prize UI

- Issue: `#61`
- Risk: MEDIUM (`R2`)
- Base SHA: `2e1a4a31516b7669536092334729efa293239444`
- Branch: `site/SITE-031-coin-terminology-prize-ui`

### Purpose and boundary

Complete the Coin terminology migration in Prize inventory and fulfillment.
Fixed user-facing status, unavailable reason, exchange value/unit, action,
confirmation, success, and typed-error text now uses Coin terminology. Backend
Prize names pass through a presentation-only currency-word transform; canonical
response objects and technical Point identifiers remain unchanged.

MIG-062Z `2.0.0-alpha.21` remains pinned without Artifact changes. The task does
not change or recompute Prize allowed actions, exchange values, status,
lifecycle, expiry, or mutation behavior. Shipping, idempotency, reconciliation,
Auth, and Session behavior are retained.

## SITE-032 — Limited Bonus Coin Presentation

- Issue: `#63`
- Risk: MEDIUM (`R2`)
- Base SHA: `8f0990bcf364d75d25f06c76b048fb06c79ddca6`
- Branch: `site/SITE-032-limited-bonus-coin-presentation`

### Purpose and boundary

Adopt the immutable MIG-063B `2.0.0-alpha.23` Artifact and add its optional,
non-nullable `limited_bonus` presentation to the existing `/points` Product
cards. Visible Backend presentations render the canonical label and amount text,
carry the returned active／upcoming state unchanged, and format returned start／
end timestamps in `Asia/Tokyo`. Inactive `is_visible: false`, an omitted field,
and a Contract-external nullish Runtime value leave no Limited Bonus element or
spacing.

The existing canonical `grant.total_points` remains the primary Product amount.
The Storefront neither adds Limited Bonus to it nor introduces paid／normal Bonus
breakdown. It does not compare campaign timestamps with the current time,
derive state or visibility, calculate amount／stacking, mutate canonical Product
objects, or add Point Purchase／Payment mutations.

## SITE-033 — Email Verification Redirect to My Page

- Issue: `#65`
- Risk: MEDIUM (`R2`)
- Base SHA: `78f3ebb47e55370fe6679f616c3b762bc0d03749`
- Branch: `site/SITE-033-email-verification-redirect-mypage`

### Purpose and boundary

The existing Register flow now passes `redirect_path: "/mypage"` to the pinned
canonical Platform Client so a newly registered member reaches My Page after the
Platform completes Email Verification, creates the Session, and returns its
Browser HTTP 303 redirect.

Before the Storefront change, the active OPS-011 Platform Runtime was verified
read-only to generate an absolute HTTPS verification URL, return Browser 303,
and retain the exact safe redirect allowlist `["/", "/mypage"]` for both
`luxe-pack.biz` and `test.luxe-pack.biz`. No registration, real mail,
verification, or Session mutation was used for this gate.

The existing Client transport, CSRF, Cookie, Session, verification API, Login,
Email Verification Notice, Register error handling, and My Page authenticated／
unauthenticated behavior remain unchanged. Platform, Artifact, Runtime,
infrastructure, and Deployment changes are outside this Task and remain zero.

## SITE-034 — Contact Page / My Page Contact Link

- Issue: `#67`
- Risk: MEDIUM (`R2`)
- Base SHA: `4098ffbb08018b132e8b14344400c1461c797873`
- Branch: `site/SITE-034-contact-page`

### Contract gate

MIG-063B `2.0.0-alpha.23` provides `POST /contact-inquiries`, operation
`createContactInquiry`, generated request／receipt types, and
`StorefrontContentContactClient.submitContact()`. The active healthy OPS-011 API
Runtime exposes the same route, and its Contact Contract／implementation files
are byte-identical to the Artifact source.

The generated `submitContact()` nevertheless requires the Storefront caller to
supply `csrf_token` and builds the Header before the Browser transport performs
Client-owned CSRF initialization and Cookie reading. No Browser-safe Contact
facade exists. A first anonymous Browser submission therefore cannot be
implemented while delegating CSRF／Cookie protocol to the canonical Client.

### Blocked boundary

The Storefront does not parse Cookies, initialize CSRF directly, fabricate a
token, intercept the generated request, call `/api/v2` directly, or reimplement
the Contact operation. The missing capability is recorded in
`docs/platform-change-requests/SITE-034-contact-browser-csrf.md`.

`/contact`, the My Page link, form, mutation adapter, and requested UI tests are
not implemented at this checkpoint. Platform／DB／Migration／Admin／Mail／Outbox／
Runtime／Infrastructure／Deployment changes remain zero.

### Resolution and implementation

STORE-SITE-034 package-only Artifact `2.0.0-alpha.24` resolves the Browser
boundary. The immutable Client and Testkit advance to alpha.24 while Site Schema
and Public OpenAPI remain referenced at alpha.23. Manifest, `SHA256SUMS`, actual
files, package identity, archive safety, and offline mixed-version dependency
resolution are verified without modifying MIG-063B.

The Storefront adds `お問い合わせ` to the existing My Page support navigation and
implements public `/contact` for anonymous and authenticated users. The adapter
uses only `createBrowserStorefrontContentContactClient()`; CSRF／Cookie protocol,
bootstrap, credentials, and Header construction remain Client-owned. The form
maps required name／email／subject／body, optional nullable phone, and the
undisplayed `website: ""`, prevents concurrent duplicate submission, and adds no
automatic retry or Idempotency.

Canonical `202` receipts display `お問い合わせを受け付けました` and the returned
`receipt_code`. Typed `422`, `429`, transport／network, and unknown failures use
Storefront-safe presentation without exposing Backend detail. Platform／API／DB／
Migration／Admin／Payment／Runtime／Nginx／systemd／Deployment changes remain zero.

## SITE-035 — Email Verification Error Page

- Issue: `#69`
- Risk: MEDIUM (`R2`)
- Base SHA: `919df909471ce71a6a5fac9ffab2b461fdbc1a63`
- Branch: `site/SITE-035-email-verification-error-page`

### Purpose and boundary

The public `/verify-email/error` route provides the approved user-facing target
for a later Platform Browser 303 redirect after Email Verification failure. It
uses only canonical query `code` for presentation: `EMAIL_ALREADY_CLAIMED`
receives its explicit message, while unknown, missing, and repeated values use
the generic fallback. Query `title`, `detail`, `type`, `stack`, raw Problem
Details, and unrecognized codes are never rendered.

The page reuses the existing narrow Authentication layout, Email Verification
card, typography, buttons, spacing, and responsive behavior. It adds no API
request, protected-route or Session requirement, CSRF／verification-token logic,
Platform error inference, Register change, `/mypage` change, or modification to
SITE-033's successful `redirect_path: "/mypage"`.

## SITE-036 — Shipping Address Management Page

- Issue: `#71`
- Risk: HIGH (`R3`)
- Base SHA: `2de3abbd1434e5df0f87872a9264c427682fa88d`
- Branch: `site/SITE-036-shipping-address-management`
- Worktree: `/var/www/luxe-pack-v2-storefront-worktrees/SITE-036`

### Preflight and Contract gate

Local／origin／GitHub Storefront `main` matched the Base SHA. Storefront lane was
idle, Open Issue／PR was empty, all Shared Locks were `none`, and SITE-036 was
unused across GitHub Issue history, Task Policies, and remote refs. Resource Gate
passed with 21 GiB disk, 2.1 GiB available memory, and 5.3 GiB swap. The active
Storefront was exact SITE-035 `main` with restart 0; active Platform API／Admin
containers were healthy with restart 0. The Preview OS lock was free.

The verified immutable STORE-SITE-034 alpha.24 Artifact retains SITE-012's
`createBrowserStorefrontPrizeShippingClient`, address list/detail/create/update/
delete methods, generated `ShippingAddressInput`, masked address collection, and
formal create idempotency／update-delete reconciliation semantics. No Platform
Change Request or Artifact upgrade is required.

### Implementation and boundary

My Page Account navigation adds `お届け先登録` immediately above `LINE連携` and
routes to login-required `/mypage/address`. The page reuses the existing Prize
Client Provider and extracted SITE-012 address fields／masked presentation. It
supports loading, canonical empty／one／multiple lists, create, detail-backed edit,
delete, generated field errors, safe typed errors, and synchronous duplicate-
submit prevention.

Create keeps one generated in-memory Idempotency Key for a same-input retry.
Update and delete are not automatically resent after an uncertain result; they
read the canonical address detail／collection first. List presentation uses only
Platform-returned masked fields. Components add no direct `/api/v2`, Cookie／CSRF
logic, URL PII, persistent Storage, console／analytics PII, or optimistic address
authority.

Prize Shipping retains canonical registered-address selection and the existing
shipping confirmation/mutation. The `新しいお届け先` CTA is removed. When the
canonical address collection is empty, shipping stays disabled and
`お届け先を登録する` navigates normally to `/mypage/address` without an address or
shipping mutation. Prize selection, `allowed_actions`, fulfillment eligibility,
Payment Hold, typed fulfillment errors, Point／Coin Exchange, Idempotency,
reconciliation, and successful canonical refetch are unchanged.

Platform／API／DB／Migration／Artifact／LINE／Payment／Nginx／systemd／Runtime／
Deployment changes remain zero. Application-only Deployment is NOT RUN and
requires later explicit Human Operator approval.

## SITE-037 — Authenticated Contact and Support Link

- Issue: `#73`
- Risk: HIGH (`R3`)
- Base SHA: `39fa0df8dda67d8da4b6489faf9515ef3bc3f709`
- Branch: `site/SITE-037-authenticated-contact-support-link`
- Worktree: `/var/www/luxe-pack-v2-storefront-worktrees/SITE-037`

### Purpose and boundary

`/contact` now waits for the canonical root Session and renders its existing
form only for an authenticated user. Loading, confirmed unauthenticated, and
expired states never mount the form; confirmed unauthenticated／expired states
replace the route with exact `/login`. No Return URL query or new redirect
contract is introduced.

My Page `お知らせ・サポート` keeps its five-row order and changes only the
`お問い合わせ` destination to exact `https://support.luxe-pack.biz/`, reusing
the existing external HTTPS link behavior. The Browser-safe Contact Client,
202 receipt, 422／429／network presentation, honeypot, and duplicate-submit
prevention remain unchanged. SITE-036 address navigation and Prize Shipping
behavior remain unchanged.

Platform／Contact API／OpenAPI／Artifact／DB／Migration／Payment／Admin／Nginx／DNS／
TLS／systemd unit／runtime env changes remain zero. Application-only Deployment
is a separate post-closeout operation under the existing Fresh Deployment Gate.

## SITE-038 — Coin Purchase Detail Page

- Issue: `#75`
- Risk: MEDIUM (`R2`)
- Base SHA: `4fb439429a3edc2e3bc909015d6c69d58f5205d5`
- Branch: `site/SITE-038-coin-purchase-detail`
- Worktree: `/var/www/luxe-pack-v2-storefront-worktrees/SITE-038`

### Contract Gate and implementation

The adopted STORE-SITE-034 Artifact retains Public OpenAPI alpha.23 and the
generated `listPointProducts` read. Canonical `PointProduct.id` is explicitly a
public opaque identifier; exact collection matching supplies title, JPY price,
`grant.total_points`, audience, sale／availability／eligibility／reason／CTA, and
optional Limited Bonus Presentation. The Contract Gate therefore passed without
a single-product endpoint, private identifier, guessed response, or Artifact
change.

`/points` adds a separately focusable `詳細を見る` Link using the percent-encoded
canonical `id`. The existing Login／disabled Purchase CTA presentation remains
unchanged and is not nested inside the new Link. Direct
`/points/purchase/[productId]` reads the same collection after Session resolution
and accepts only an exact `id` match. It distinguishes loading, configuration,
Session error, collection error, successful Not Found, and ready presentation
without inventing Product data.

The detail displays title, Backend amount/currency, canonical total Coin grant,
audience, sale state, eligibility/reason, and visible SITE-032 Limited Bonus.
It does not calculate paid plus bonus, add Limited Bonus to total, compare
Campaign time, or infer availability. Purchase Button／Payment CTA／Provider／
mutation／redirect／polling／callback／webhook／Coin grant／DB write are absent.
Platform／OpenAPI／Artifact／Runtime／Infrastructure changes remain zero, and
Application-only Deployment is NOT RUN.

## SITE-040 — Payment Purchase Flow

- Issue: `#77`
- Risk: CRITICAL PAYMENT (`R4`)
- Base SHA: `58a6bc6b6119f7daaa2d415c3b9e4c3db4f98b18`
- Branch: `site/SITE-040-payment-purchase-flow`
- Artifact: immutable MIG-089 `2.0.0-alpha.28`

SITE-040 retains SITE-038's exact public `PointProduct.id` collection boundary
and adds the canonical paid／bonus／active limited bonus purchase summary plus
Credit Card, PayPay, Konbini, and bank-transfer selection. All Payment and Card
operations stay behind the alpha.28 Browser Payment Client with a caller-owned
Idempotency Key and no Frontend Coin grant authority.

New Card fields are mounted only through the official fincode UI Component after
`getPaymentCardUiBootstrap()`. The Storefront requires mount success, never reads
PAN／CVC or calls `getFormData()`, and leaves save-and-pay registration completion
to the Platform purchase flow. Canonical `pid` reads determine every Return and
thanks state; Card／PayPay polling is bounded to 30 seconds, while Konbini／bank
transfer resume only the existing Payment.

Local Artifact／policy／boundary／lint／typecheck／316-test／production-build／audit／
secret gates pass. Purchase History is NOT IMPLEMENTED. Provider Browser E2E is
HOLD and Application-only Deployment is NOT RUN. Platform Repository／DB／
Migration／Runtime／Infrastructure remain unchanged.

## SITE-041 — Purchase History / Unpaid History

- Issue: `#79`
- Risk: CRITICAL PAYMENT (`R4`)
- Base SHA: `e80563d6589a97a66a5d8b7295a8d8d7902721e7`
- Branch: `site/SITE-041-purchase-history-unpaid-history`
- Artifact: retained immutable MIG-089 `2.0.0-alpha.28`

SITE-041 adds `購入履歴` immediately above `コイン履歴` on My Page and connects
authenticated `/mypage/purchases` to the generated `listPayments` operation.
The succeeded and unpaid tabs send only the canonical `view`, preserve returned
order, and pass an opaque continuation cursor unchanged. Rows show only
`grant.paid_points`, canonical amount, creation time, and mapped Payment method;
they perform no status, unpaid, expiry, or Grant filtering／recalculation.

`/mypage/purchases/[paymentId]` uses only ownership-checked `getPayment` and the
persisted Payment Grant snapshot. Optional Bonus rows use the returned snapshot,
and total Coin uses `grant.total_points` without arithmetic. Eligible Konbini／
Virtual Account detail resumes the existing Payment through
`resumeUnpaidPayment`; canonical `expired` renders a disabled control and performs
no mutation. SITE-040 purchase／Card／Return／polling behavior remains unchanged,
apart from the confirmed success link to Purchase History.

Receipt is NOT IMPLEMENTED. Provider Browser E2E is HOLD and Application-only
Deployment is NOT RUN. Platform Repository／DB／Migration／Runtime／Provider／
Infrastructure and Artifact adoption remain unchanged.

Local Artifact／Policy／all boundary／lint／typecheck／331-test／production-build／
dependency-audit／secret gates pass. All 23 changed files are exact Task Policy
paths with no wildcard or scope escape.

## SITE-042 — Wallet Sync / Storefront UI Hygiene

- Issue: `#81`
- Risk: CRITICAL WALLET／PAYMENT (`R4`)
- Base SHA: `aa4bd5a16c038a8e3d2145fb36cc12bda798a366`
- Branch: `site/SITE-042-wallet-sync-ui-hygiene`
- Artifact: retained immutable MIG-089 `2.0.0-alpha.28`

SITE-042 makes the shared canonical Wallet read refreshable without adding a new
endpoint or Frontend balance authority. Successful Draw, Prize Coin Exchange,
and canonical Payment `succeeded` confirmation refresh `getWallet()` immediately.
Visible pages poll every 60 seconds, hidden pages stop periodic reads, and
visibility／focus return refreshes are deduplicated. Concurrent refreshes are
coalesced, one trailing mutation read is preserved behind an older passive read,
and a temporary background error does not erase a valid displayed balance.

The `/points` Product cards remove only `購入対象です。`, `購入可能`, and
`購入手続きは準備中`; canonical details, Product presentation, eligibility,
ineligible reasons, and action availability remain intact. Human-confirmed
technical Gacha／Wallet／Product／History／LINE copy is removed or replaced, while
unconfirmed source-wide audit candidates remain unchanged and are recorded in
`worklogs/report/SITE-042.md`.

Local Artifact／Policy／all boundary／lint／typecheck／339-test／production-build／
dependency-audit／secret gates pass. Changed files are exact Task Policy paths
with no wildcard, symlink, or scope escape. Provider Browser E2E is HOLD and
Application-only Deployment is NOT RUN.

## SITE-043 — Payment Client alpha.29 Adoption / Card UI Fix

- Issue: `#83`
- Risk: CRITICAL PAYMENT (`R4`)
- Base SHA: `30c6334c39a7c698dd18fa93243dfd29c2af4cfe`
- Branch: `site/SITE-043-payment-client-alpha29-card-ui-fix`
- Artifact: immutable MIG-094 `2.0.0-alpha.29`

SITE-043 adopts the canonical package-only MIG-094 Client／Testkit while retaining
MIG-089 alpha.28 byte-for-byte. Public OpenAPI remains alpha.27 with the same
SHA-256. The alpha.29 canonical `resumeUnpaidPayment()` supplies the Browser-safe
empty JSON POST body; Storefront adds no raw fetch, Content-Type override,
middleware workaround, replacement Payment, or Provider session. Konbini and
Virtual Account keep Purchase → Thanks Page → guide → existing redirect resume.

The Card UI root cause is the exact-pinned `@fincode/js@1.1.0` loader's malformed
existing-script selector, which rejects before the official fincode resource is
injected. Storefront now dynamically loads the official test/live fincode script,
then calls canonical `initFincode()`, `ui.create("payments")`, and `ui.mount()`.
SDK-load, init, create, and mount failures are internally classified, safely
presented through the existing generic UI, and never log or retain Public API Key
values, PAN, CVC, Provider response bodies, Cookie, Session, Secret, or Token.
Purchase becomes available only after mount succeeds. Unmount, method changes,
and Bootstrap changes clear the mounted UI. `getFormData()`, PAN/CVC React state,
undocumented iframe events, and purchase-flow registration completion remain
absent.

Local Artifact／Policy／all boundary／lint／typecheck／358-test／production-build／
dependency-audit／secret gates pass. PayPay start/redirect handling, saved Card,
save-and-pay, Konbini／Virtual Account Thanks and resume, histories, Wallet sync,
polling, and Return behavior retain regression coverage. Application-only
Deployment and Provider Browser E2E are NOT RUN. Platform／DB／Migration／Nginx／
DNS／TLS／systemd／runtime environment／Provider configuration remain unchanged.

## SITE-044 — Credit Card UI Browser Fix / Konbini Unpaid Error Copy

- Issue: `#85`
- Risk: CRITICAL PAYMENT (`R4`)
- Base SHA: `7fae62be0d841d9db5b319acc2b7cf381a46277d`
- Branch: `site/SITE-044-credit-card-ui-browser-fix`
- Artifact: retained immutable MIG-094 `2.0.0-alpha.29`

SITE-044 re-audits the official `@fincode/js@1.1.0` package and active fincode
Browser runtime after Human Browser acceptance showed SITE-043 remained blank.
SITE-043's malformed existing-script selector was real but only the first
failure. Once preload bypassed it, `ui.mount()` required the additional exact
`elementId + "-form"` DOM wrapper and a numeric width. The Storefront supplied
neither contract correctly, so mount threw before iframe creation. The component
now renders both required nodes, passes a bounded numeric width, confirms the
official iframe before enabling purchase, and preserves cleanup／remount behavior.

The purchase error boundary presents exact
`コンビニ決済の未払いがあるため、コンビニ決済を使用できません` only for current
method `konbini` plus canonical `ApiProblemError.code` exact
`KONBINI_UNPAID_LIMIT_REACHED`. It does not inspect title／detail／message or HTTP
status alone and does not apply to transport, PayPay, Virtual Account, Credit
Card, or other errors. Unpaid history selection, Platform business rules,
Thanks／resume, Client／Testkit／OpenAPI, package／lockfile／vendor, and runtime／
infrastructure remain unchanged. Application-only Deployment and Provider
Browser E2E are NOT RUN.

## SITE-045 — Temporarily Hide LINE Link UI

- Issue: `#87`
- Risk: HIGH GOVERNANCE (`R4`)
- Base SHA: `1fcc9bd3e46414b7755fb75628ee60c1c8937927`
- Branch: `site/SITE-045-temporarily-hide-line-link-ui`
- Artifact: retained immutable MIG-094 `2.0.0-alpha.29`

SITE-045 removes only the LINE account-link entry from
`myPageAccountNavigation`, so authenticated `/mypage` users no longer receive a
LINE menu row in either desktop or mobile presentation. The Account section
retains `お届け先登録`; Purchase History, Coin History, Draw History, Prize,
Support, and Logout navigation remain unchanged.

The canonical `accountNavigation` LINE entry, `lineAccountRoute`,
`publicRoutes`, and direct `/mypage/line` page remain present. LINE Client,
external-identity and Friend State Contracts, callback and account-link
implementations, Platform, Provider configuration, Payment, Coin, package,
Artifact, infrastructure, and runtime behavior are unchanged. No feature flag,
404, or redirect is introduced.

Local Artifact／Policy／all boundary／lint／typecheck／40-file 376-test／
production-build／dependency-audit／secret gates pass. Focused My Page, Route,
LINE UI, external-identity, and Friend State coverage passes 5 files／34 tests.
All changed files are exact Task Policy paths with zero wildcard or scope
escape. Application-only Deployment is NOT RUN.

## SITE-046 — alpha.30 Adoption / Card Merchant Return Integration

- Issue: `#89`
- Risk: CRITICAL PAYMENT (`R4`)
- Base SHA: `126816f8e1102749a3b79289c033e003ecac93c1`
- Branch: `site/SITE-046-alpha30-card-merchant-return`
- Artifact: immutable MIG-096 `2.0.0-alpha.30`

SITE-046 adopts canonical package-only MIG-096 Client／Testkit without changing
MIG-094 alpha.29 or Public OpenAPI alpha.27 bytes. Card Registration Intent now
uses the alpha.30 Client's canonical JSON `{}` POST with no Storefront fetch or
Content-Type workaround.

Post-start Card behavior dispatches only the returned `Payment.next_action`.
Card Component execute passes Platform `return_url` and `failure_url` unchanged
to fincode `return_url` and `return_url_on_failure`; returned `redirect_url` is
only 3DS navigation. Saved Card and save-and-pay navigate the Platform-returned
3DS Action after Platform-side execute, with no dependency on the pre-start
new／saved selection. `/cards/success`／`/cards/failure`, merchant URL generation,
PAN／CVC state or logging, and purchase-flow registration completion remain zero.

Local Artifact／Policy／all boundary／lint／typecheck／40-file 376-test／
production-build／dependency-audit／secret gates pass. All 25 changed files are
exact Task Policy paths with wildcard zero. Application-only Deployment and
Provider Browser E2E are NOT RUN; Platform／DB／Migration／Webhook／infrastructure／
runtime／Provider configuration remain unchanged.

## SITE-047 — Card Failure Return Final Screen Fix

- Issue: `#91`
- Pull Request: `#92`
- Risk: CRITICAL PAYMENT (`R4`)
- Base SHA: `bddff7106a8e710859a94cc07ada9a93b18aa136`
- Branch: `site/SITE-047-card-failure-return-final-screen-fix`
- Artifact: retained immutable MIG-096 `2.0.0-alpha.30`

Stage 0 live readback confirmed local／origin／GitHub main and active Storefront
Runtime at the exact Base, a clean main worktree, no open Storefront Issue／PR or
task conflict, free Shared Locks, healthy MIG-097 Platform API, and HTTP 200 with
redirect zero on the three required Storefront same-origin API reads. The
root-owned mode `0600` Task Policy binds exact five paths with wildcard zero.

The purchase-page `PaymentReturnAlert` no longer has a Thanks navigation or
redirecting state. A failure Return stays on the Coin purchase page and presents
the canonical failure copy across `created`／`requires_action`／`processing` races,
an inconsistent `succeeded` read, and terminal `failed` remount. It never exposes
the Thanks `決済処理中` presentation. The canonical Payment read and Product
correlation remain read-only; invalid `pid` stays contained and no Payment／Coin
mutation is available to this Return flow.

Normal success Return remains on the existing Thanks page. PayPay, Konbini, and
Virtual Account behavior, Platform Return URL／303 Location, MIG-097, alpha.30
Artifact, Platform／DB／Migration／Provider／infrastructure, and Save Card are
unchanged. Provider Browser E2E is reserved for Human acceptance after exact
squash-main Application-only Activation.

Frozen install and local Artifact／Policy／all boundary／lint／typecheck／40-file
386-test／production-build／dependency-audit／secret／diff gates pass. Focused
Payment status coverage passes 1 file／29 tests. Changed files are the exact five
Task Policy paths with wildcard and scope escape zero. Fresh exact-head Required
Checks and R4 self-review remain required before Squash Merge.

## PRG-20261002 — Storefront Minor Shadow Classifier

- Human-authorized Phase 1 only; Issue none, Risk R4, Lane Strict Change, Application Runtime Activation none. Dedicated Worktree and branch `feat/PRG-20261002-phase1-shadow`, base/protected main `474736bef3f5534af9c0d0824965c230e587c5c1`. Existing primary Worktree files, local Runtime configuration and uncommitted work are untouched.
- Formal v1.1 SHA-256 verified: `e7e3a6fedfa232d06e00e36f14e79399d03fc6f5dfa8550f801b60d57a2e87a9`. Added offline complete-diff classifier, TypeScript AST/CSS/raster checks, versioned Machine Policy, 19-domain impact map, transitive importer analysis and focused Human Browser Acceptance plan. Canonical source/check/provenance validators are reused through offline adapters.
- Machine Policy numeric limits remain PROPOSED_SHADOW_ONLY with null approval fields. No Human approval is generated; unapproved policy falls back. Default CI has no Production handoff and records Full/UNKNOWN. Existing alpha.42 pins, Artifact provenance, Required Checks, application code and Production workflow remain unchanged. Independent Shadow workflow uploads observations only; the existing integration test suite includes classifier tests.
- Initial focused classifier 56 PASS; classifier plus existing provenance/workflow regression 155 PASS; artifact:check and focused ESLint PASS. Added handoff/adapter coverage and final-head results are recorded on the PR. Browser/E2E, Human Acceptance, Production Artifact dispatch, Build/Stage/Activation, Contract publication, Migration, ENV/Secret access and NEW Production connection: not performed.
- Production impact NONE, CI skip false, blocking authority false. Policy approval, actual Human-assisted evidence, Human GO, merge, Phase 2 and Promotion remain pending. PR/CI completion stops for Human review. Source rollback is a reviewed revert PR with no Runtime operation.

- Final protected-main drift reconciliation: merge `30099a9d8ed8a59b7072dbee398da74c27078e6f` into this dedicated Gate branch. The concurrent prize-exchange component/tests and Worklog are outside the seven protected Gate areas. Only the add/add Worklog conflict is resolved, preserving both records in full; no primary-worktree content is copied. Focused tests and every Required Check are rerun for the resulting final head. This is task-branch baseline integration, not PR merge or Production activation.

# Storefront fix batch local worklog

## STOREFRONT-FIX-BATCH-20261002 — Initial local-only phase

- Date: 2026-10-02 UTC. Issue: none. Risk: R3. Lane: Strict Change.
- Application Runtime Activation: deferred.
- Branch: `fix/STOREFRONT-FIX-BATCH-20261002`; dedicated worktree retained.
- Start authority: live GitHub branch API returned `main`, `protected: true`,
  SHA `474736bef3f5534af9c0d0824965c230e587c5c1`; `git ls-remote` agreed.
- Base and current HEAD: `474736bef3f5534af9c0d0824965c230e587c5c1`.
  No task commit. Changes remain uncommitted for further Human-directed fixes.
- Latest Human instruction limits this phase to source changes and local tests.
  Push, PR, Required CI, merge, and OLD Test activation are NOT RUN.
- Existing occupied worktrees were left untouched. No migration or source lock
  was acquired; the isolated source/test scope does not overlap the seven
  reserved Gate areas. No Task Policy file was created.

### Root cause and read-only Platform evidence

`exchangePrizes()` succeeded, then `reconcileReads()` awaited inventory,
shipping addresses, and shipping requests together. An SMS-unverified user's
address read rejects with `SMS_VERIFICATION_REQUIRED` (403). Inventory can
already show `converted` and clear selection, while the rejection reaches the
exchange catch block before the wallet event and success message. The generic
Problem presentation produces the reported false failure.

Read-only review used Platform main
`35f3ec0b3a578e8551dab08523b1fc2a38c61af6`:

- `V2PrizeShippingService::exchange()` wraps the point grant, prize transitions
  to `converted`, completed exchange request, idempotency completion, audit,
  and outbox in `transactionWithHoldAudit()` / `DB::transaction()`.
- `V2PointService::grantPrizeExchange()` requires an active transaction and
  writes the free-point wallet, lot, operation, and ledger together.
- `prizeAllowedActions()` has no SMS or Gacha-origin condition. Backend status,
  hold, expiry, shipping-only, and exchange-value decisions remain authoritative.
- Address reads require SMS verification; shipping-request list reads do not.
  The existing `PrizeShippingVerticalSliceTest` covers the address restriction,
  accessible shipping history, exchange grant/replay, and invalid-item rollback.
- These are source/test-source findings. Platform tests were not executed and
  no live user's transaction or database was inspected.

### Changes

- `src/components/prizes/prize-fulfillment.tsx`: exchange awaits only inventory
  reconciliation, then emits the existing wallet refresh event and displays
  the successful API result. Exchange copy no longer claims shipping/address
  refresh. Shipping reconciliation and mutation error handling are unchanged.
- `src/test/prize-inventory-ui.test.tsx`: integration coverage through real
  inventory, dialog, session, wallet provider, and wallet presentation components,
  using mocked canonical clients and synthetic fixtures. Login and standard
  prizes use the same public UserPrize shape (which has no Gacha-origin field).
- `src/test/prize-fulfillment-ui.test.tsx`: update the exchange read contract;
  strengthen retry/error and existing shipping reconciliation assertions.
- `worklogs/new_ver_main.md`: local batch handoff record.

### Executed validation

- RED before source fix: both new login/standard cases failed on missing success;
  rendered output reproduced converted status, zero selection, generic error,
  and unchanged wallet balance. The name filter intentionally skipped 11 cases.
- GREEN after fix: focused inventory/fulfillment tests, 2 files / 29 tests PASS.
- Expanded local regression: 9 files / 122 tests PASS, no skips or failures:
  prize inventory, fulfillment, prize client contract, wallet reads, address
  management, SMS verification, standard Gacha draw, login Gacha UI and contract.
- Assertions cover one exchange call, zero shipping-address and shipping-request
  reads, inventory refresh, wallet event and rendered refreshed balance, success
  with selected=0, absence of false error, close without resubmission, mutation
  failure/retry handling, and preserved shipping behavior.
- Focused ESLint, `pnpm typecheck`, prize/point boundary checks, secret scan,
  and `git diff --check`: PASS. Frozen offline dependency install changed no
  package or lockfile. No binary, generated, dependency, or submodule changes.
- Full test suite, application build, Browser/E2E, Platform tests, Required CI,
  Preview/OLD Test/Production/NEW activation, and Contract publication: NOT RUN
  under the requested local-only scope. UI evidence is jsdom, not browser proof.

### Retained state and boundaries

- Platform/API/DB/Auth policy/point accounting/payment/draw authority/Admin/Agency:
  zero changes. Contract changes: zero. Migrations created/applied: zero.
- All seven reserved Gate areas: zero changes (CI workflows, Required Checks,
  Production Artifact workflows, source-authority/provenance validators, Gate
  classifier, impact map, release evidence schema).
- Remote main remains the start SHA. Dedicated branch/worktree remain available;
  no branch cleanup or local main synchronization is performed for this batch.
- CI wait, check reruns, builds, runtime activations, and Human wait: zero.
  Final-head machine-readable PR self-review and merge evidence are deferred
  until the Human-authorized batch PR. No merge readiness claim is made.
- Known limit: inventory-refresh failures retain existing handling; this fix
  removes the confirmed unrelated shipping-read dependency. No live activation
  means no runtime rollback is needed; the isolated source delta is reversible.
- Result: `STOREFRONT_PRIZE_EXCHANGE_FIX_LOCAL_PASS_BATCH_PENDING`.

## Authorized delivery and OLD Test acceptance

The next explicit Human instruction authorizes this Storefront-only fix to
proceed through commit, push, PR, Required CI, reviewed-head real Chromium,
fresh self-review, squash merge, OLD Test Storefront activation and Technical
Acceptance. Human Browser Acceptance remains pending; Production and NEW are
prohibited. This section supersedes the initial phase's local-only restriction.

- Issue: #131, for release/acceptance coordination. Risk: R3. Lane: Strict Change.
  Application Runtime Activation: immediate, limited to OLD Test Storefront.
- Same dedicated branch/worktree retained. At delivery start, live protected
  main and fetched origin/main both remain
  `474736bef3f5534af9c0d0824965c230e587c5c1`. No upstream changes to reconcile.
- Exactly four changed files remain: the fulfillment component, its test,
  inventory test, and this worklog. All seven reserved Gate areas remain at zero.
- A root-owned transient exact-path policy supports the installed GitHub App
  wrapper; it permits only this Change's delivery operations and is outside Git.
- Pre-PR validation: 9 focused files / 122 tests, repository lint, typecheck,
  artifact validation, prize/point boundaries and secret scanning all PASS.
  Required CI and
  real Chromium evidence will be recorded on the exact final-head PR; no
  mocked test is substituted for live API acceptance.
- Merge requires fresh live-main/path/check review and SEV-0=0 / SEV-1=0.
  Activation requires reviewed-head tree = squash tree, content diff 0, measured
  OLD runtime/health/disk/upstream/rollback preflight, and the existing activation
  method. Platform API/Admin/Worker and all other runtimes remain untouched.
- No direct DB setup, migration, Contract publication, or dependency change is
  authorized. API-driven QA prize exchange/shipping checks require dedicated
  synthetic QA accounts; no real-user data is used.
- Final merge, runtime, Technical Acceptance and cleanup results belong to the
  PR/Issue closeout record so the reviewed source remains immutable.

## STOREFRONT-SEC-20261005-SANITIZE-HTML — isolated runtime dependency remediation

- Human instruction: update sanitize-html exactly from 2.17.6 to 2.17.7 for
  GHSA-g8qq-57p8-ggw5; implementation, validation, commit, push, PR and self-review
  are authorized. Merge and auto-merge are explicitly NOT AUTHORIZED.
- Issue #135 tracks pending Human review. Risk R3; Lane: Strict Change;
  Application Runtime Activation: none. Wrapper task ID: SEC-20261005.
- Freshly fetched origin/main and live protected main both equal
  `b9224c900191ede206d89af768a62998f72aca20` at task start.
- Dedicated branch `fix/SEC-20261005-sanitize-html-2.17.7` and isolated worktree;
  existing dirty worktrees, PR #134 and the Security Policy branch are untouched.
- Exact scope: package.json, pnpm-lock.yaml and this worklog. The installed
  GitHub App wrapper uses a transient exact-path task policy outside Git with
  no merge, auto-merge, deployment or branch-deletion permission.
- package.json pins 2.17.7. `pnpm install --lockfile-only` with pnpm 10.12.1
  regenerates the lockfile; no manual lockfile edits or unrelated dependency
  changes. Node 22.22.3 and pnpm 10.12.1 match the existing CI versions.

### Fresh audit, all severities

- `pnpm audit --prod --json`: raw exit 0; info 0, low 0, moderate 0, high 0,
  critical 0; advisories empty. Additional runtime findings: zero.
- `pnpm audit --json`: raw exit 1; info 0, low 0, moderate 5, high 1,
  critical 0. Every advisory and dependency path was parsed from fresh JSON.
- GHSA-g8qq-57p8-ggw5 is absent in both results; sanitize-html findings: zero.
- Remaining dev-tool findings, without remediation or exception in this task:
  - vitest 4.1.10 and @vitest/mocker 4.1.10: GHSA-82fw-gwwq-j7x9, moderate,
    two package findings through the direct vitest dev dependency.
  - fast-uri 3.1.7: GHSA-hrr3-gc8f-f4qj, moderate, via @oripa/site-schema > ajv.
  - brace-expansion 1.1.20 and 5.0.11: GHSA-q2hr-2g5m-vwhr, moderate,
    two package findings through eslint and eslint-config-next respectively.
  - braces 3.0.3: GHSA-vfj7-8cjw-p6xm, high, via eslint-config-next >
    @next/eslint-plugin-next > fast-glob > micromatch.
- No finding is suppressed or allowlisted. Full audit is not claimed clean.
  CI's high-severity audit may remain blocked by the existing braces finding;
  Required Checks and Security Policy must not be weakened to resolve it.

### Validation and retained boundaries

- Fresh frozen install, typecheck, focused public-content-ui tests (8/8),
  artifact validation, content boundary, secret scan and diff whitespace: PASS.
- Full lint/test/build, clean archive validation and final-head GitHub Required
  Checks are recorded in the PR after execution, including any failures. This
  worklog does not predeclare their result or claim Browser/E2E acceptance.
- Existing sanitization tests cover script removal, event handlers, unsafe links,
  safe content structure and external links; application configuration is unchanged.
- Application source, allowedTags, allowedAttributes, sanitization policy,
  Content behavior, API, Contract, routing, Auth, Payment, Draw and Points: no
  source changes. No Platform or infrastructure changes; migrations created 0,
  applied 0. No Production, OLD Test, NEW Server, environment/secret access,
  runtime restart, database operation, deployment or Contract publication.
- No braces override, eslint-config-next update, Security exception, general
  allowlist, Machine Policy, Impact Map, classifier or scripts/readiness changes.
- Source rollback is a reviewed reversal of these dependency pins and generated
  lockfile changes; no runtime rollback is needed because nothing is activated.
- Final head/tree, fresh self-review and CI outcomes belong to the PR. Branch
  and worktree remain for Human review; no merge, cleanup or main synchronization
  is authorized in this task. Production GO remains outside scope.

## STOREFRONT-CI-SECURITY-BOOTSTRAP-20261005

- Latest Human instruction authorizes a new bootstrap PR containing #136's
  exact sanitize-html remediation and the exact braces dev-tool exception.
  Risk R3; Lane: Strict Change; Application Runtime Activation: none; Issue: none.
  Merge and auto-merge remain explicitly unauthorized.
- Starting live protected main and fetched origin/main both equal
  `b9224c900191ede206d89af768a62998f72aca20`, tree
  `6e376e0933ac7f311f8502254a2e6db4099b97d7`.
- Dedicated branch `fix/CI-20261005-storefront-security-bootstrap` and a new
  dedicated worktree isolate this Change. The historical Security HOLD branch
  and its uncommitted 66-line worklog delta remain untouched and uncopied.
- Imported exact #136 commit `1188b98c119645e728236c01e0bdd950a0b12e45`.
  Integration tree equals #136's `10bb862b941439a517b18afd6ef5a7c5d987b350`.
  package.json and pnpm-lock.yaml remain byte-identical to that commit: only
  sanitize-html 2.17.6 -> 2.17.7 and its corresponding lock/integrity change.
  The original #136 worklog is preserved above as historical evidence.
- Scope: those two dependency files, this worklog, .github/workflows/ci.yml,
  scripts/ci/security-audit-policy.mjs, src/test/security-audit-policy.test.mjs,
  and docs/security-audit-policy.md. No Machine Policy, readiness, impact map,
  classifier, inventory or application source changes.
- GitHub connector identity was read back as `myong-ideal`. All bootstrap GitHub
  writes must use that connector account; no Primary/Hkouno or GitHub App writes.
  Git object publication must preserve the locally reviewed tree exactly.

### Policy and fresh evidence

- Fresh pnpm 11.25.0 evidence from the imported dependency state confirms
  production info/low/moderate/high/critical = 0/0/0/0/0, raw exit 0. Full counts
  are 0/0/5/1/0, raw exit 1. GHSA-g8qq-57p8-ggw5 is absent in both audits.
- Full blocking threshold remains High. The collector requests all-severity
  JSON with --audit-level info so lower-severity records cannot be hidden by
  pnpm's output filter. The validator, not that collection filter, applies the
  unchanged High/Critical blocking rule. Production must be zero at all levels.
- Moderate evidence remains visible and nonblocking, without a baseline or
  allowlist: vitest 4.1.10 and @vitest/mocker 4.1.10 (GHSA-82fw-gwwq-j7x9),
  fast-uri 3.1.7 (GHSA-hrr3-gc8f-f4qj), brace-expansion 1.1.20 and 5.0.11
  (GHSA-q2hr-2g5m-vwhr). No Moderate remediation or new blocking policy.
- Sole High exception: GHSA-vfj7-8cjw-p6xm / audit ID 1240992 / braces 3.0.3,
  exact path `.>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces`.
  Fingerprint: vulnerable_versions <=3.0.3, patched_versions null,
  patched_versions_unpublished true, CWE-674, CVE/CVSS ABSENT. Any appearance or
  security-state change invalidates it. Descriptive fields are nonblocking.
- Machine proof checks root eslint-config-next is dev-only, absent from runtime,
  optional and peer sections, manifest/importer alignment, each locked chain
  edge, braces package/version and fresh production-zero evidence. No reliance
  on the audit's dev flag alone. Raw statuses/counts/errors fail closed.
- Event-driven invalidation has no expiry or periodic review. A published patch
  requires remediation. Advisory disappearance is RESOLVED / IMPROVED and PASS.
  Successful output reports actual findings and applied exceptions separately.
- Existing artifact, secret and all boundary checks and all five Required Check
  names remain intact. Readiness-shadow source and workflow remain unchanged.

### Validation, delivery and retained boundaries

- Frozen install, typecheck, lint, policy/artifact/secret checks and every
  boundary check passed locally. Initial focused tests passed (77 cases);
  an additional Moderate-policy regression is included in final validation.
  Fresh policy evaluation passed with 1 current High/Critical, 1 approved exact
  exception, 0 unapproved High/Critical, 5 Moderate and 0 production findings.
- Final full-suite counts, builds, clean git-archive validation, final-head fresh
  audits, fresh GitHub CI and fixed-head self-review are recorded in the new PR
  after execution. This entry does not predeclare pending results. An initial
  test harness URL issue and local audit executable invocation failure were
  corrected; the validator's fail-closed behavior remained intact.
- #134 at ce1c68b028d16690b129ba36ee064c3ff038ac50 and draft #136 at
  1188b98c119645e728236c01e0bdd950a0b12e45 are preserved OPEN and UNMERGED.
  Neither PR is changed or closed by this task. The new PR awaits Human review.
- No ENV/Secret access, OLD Test/Production deployment, NEW Server operation,
  runtime restart, Nginx change, DB operation or Contract publication.
  Migrations created/applied: 0/0. API/auth/point/payment/draw authority unchanged.
  Browser/E2E and runtime acceptance are not run under this source/CI-only scope.
- Source rollback requires a reviewed PR; reverting the sanitizer pin would
  reintroduce its runtime advisory. No runtime rollback applies. Branch/worktree
  remain for Human review; no main synchronization or cleanup of other worktrees.
  Final SHA/tree, remote equality, check/build counts and elapsed times belong
  to the PR evidence so the reviewed source remains immutable.

## SF24H-20261005 — alpha.43 adoption / integration (2026-10-05, local HOLD)

- Risk R3; Lane Strict Change; Application Runtime Activation deferred.
  Human authorized REL-043 merge and a new Storefront integration PR, but no
  Storefront merge or runtime activation. No integration Issue/PR exists yet.
- Platform PR #541 reviewed head `490ae35e74b8c28c43eb6ba50261eb766941e820`
  passed live authority, all Required Checks and refreshed fixed-head review
  (`ideal-sol/oripa#541`, comment 5996647709). Canonical App squash merge:
  `f02369d6050117f993e027e44c0675bb8af54dec`. Protected main/origin main exact;
  reviewed tree equals merged tree, content diff zero. Protected-main ledger:
  latest_immutable `2.0.0-alpha.43`, candidate null, Artifact `11349442812`.
  Publication lock released after merged-ledger/readback verification.
- Storefront starting/current protected main:
  `eead719007d3483ceb4e270a431f6c591430c2fc`. Presentation Authority is OPEN
  PR #139 exact head `aa3b62b637933fe1b29563e1c8926251c3734486`, original base
  `aec90bb24e02696d40afd3d19f6459b698ff4d59`. Main's six Readiness paths and
  PR #139's fourteen paths have no path overlap. New isolated branch
  `feat/SF24H-20261005-integration`; prior occupied integration worktree and
  unrelated dirty primary checkouts are preserved, not reset or overwritten.
- Exact Artifact ID download and outer SHA256, manifest, SHA256SUMS, Client,
  Testkit, OpenAPI, source/version checks passed. Source remains PR #540 squash
  `0ce41ab473fd5a4fb44773041ae097ffb40b14ce`, not reconciliation source.
  Run `37319224331`, attempt 1; all exact hashes and immutable payloads are in
  `vendor/oripa/CONTRACT-20261005/PROVENANCE.md`. Client/Testkit exact alpha.43
  pins, Public Contract alpha.39, Site Schema alpha.23 unchanged. No rebuilding
  or republication, no unrelated dependency update; older vendors unchanged.
- Normal Home/Header/points/detail use canonical Point Client collection.
  Backend `first_user_offer` owns active/expired/unauthenticated/unavailable;
  product eligibility/CTA remain authoritative. Display timer starts with
  expires_at-as_of and subtracts monotonic elapsed time, then refetches at zero.
  It does not infer eligibility from wall clock, registration time or storage.
- Normal display price=grant.total_points; saving=grant.bonus_points; discount
  uses integer-floor ratio. Hero/Popup select cheapest eligible product with
  stable Backend ties; maximum OFF is separate across displayed first-user
  products. Consumed/expired detail retains actual price with disabled purchase.
  Copy specifies first email verification and each product once, without
  normal-price-after-expiry conversion. Fixed samples stay Preview-only.
  PR #139 CSS and original layout tests are byte-identical. Existing Auth,
  Session, Payment components and Platform adapter source are unchanged.
- Validation executed: frozen install; artifact, policy, all nine boundary
  checks, lint, typecheck, secret scan and production build PASS. Focused final
  run: nine files / 148 tests PASS, including first-buy/layout, Point read/detail,
  purchase, Card/3DS/Save Card and retained Point/Payment/Draw/Prize contracts.
  Initial new Popup assertion used a wrong currency formatting expectation;
  corrected to the existing DOM's exact normal/actual yen text. A concurrent
  focused run timed out awaiting a Point read; unchanged serialized rerun PASS.
- Full suite was executed: 57 files / 1120 tests, 1114 PASS / 6 FAIL. Four were
  stale alpha.42 OpenAPI digest assertions; synced to verified alpha.43 digest
  and passed in the final focused run. Remaining two Readiness grounding tests
  reproduce failure because `source-inventory.v1.json` lacks the twelve new
  src paths. Inventory/tests/classifier/workflow are NOT modified. Requested
  Human approval for only the twelve path additions to this one fixture;
  HOLD on scope expansion, commit, push and PR. No full-suite PASS is claimed.
- Fresh pnpm 11.25.0 security policy audit PASS: production findings zero at all
  levels, unapproved High/Critical zero, one existing exact dev-only braces
  exception, five visible Moderate findings. No exception/policy changes.
- Diff/whitespace, exact Artifact bytes and source/path checks PASS. No migration
  created/applied (0/0). Browser/E2E/Preview Runtime acceptance NOT RUN. GitHub
  integration Required Checks NOT STARTED because pre-commit gate is blocked.
  Source rollback would be a reviewed revert PR; no runtime rollback applies.
- PR #139 NOT MUTATED / NOT MERGED; integration commit/push/PR/merge NOT PERFORMED;
  OLD Test NOT DEPLOYED; runtime/Nginx/Production/NEW NOT TOUCHED. No credentials,
  private server paths or user data are included in the adoption payload.

### Human-approved Source Inventory synchronization / delivery resumed

- Human approved only `scripts/readiness/source-inventory.v1.json` plus this
  worklog. Before editing, `git ls-files --cached -- src` identified 224 actual
  tracked files versus 212 inventory entries: exactly 12 missing, 0 extra.
  Integration was not yet committed: starting HEAD still had 212 src files;
  the twelve additions were already staged/tracked integration source, not
  fictional paths inferred from a previous report. After commit the same
  inventory must equal the exact committed HEAD tree.
- Mechanically generated lexicographic additions, no deletion or other entry
  mutation: design first-buy detail route; first-buy connected, home, layout
  bar, layout preview and offer components; countdown/offer hook; layout and
  offer presentation helpers; first-buy CSS; contract and layout tests.
  Missing=0, extra=0, all 224 entries exactly match the tracked src tree.
- SHA256 comparison against the pre-sync snapshot proves every tracked file
  except Inventory/Worklog byte-identical. No first-user implementation, pin,
  classifier, impact map, readiness tests, workflow, Fast Lane condition,
  Machine Policy or Gate logic change. Previous focused 148-test PASS remains
  tied to the identical source; those tests also passed in the new full run.
- Re-executed `pnpm validate`: PASS, including artifact/policy, all nine
  boundaries, lint, typecheck, full 57-file / 1120-test suite and production
  build. Dedicated Readiness run: 258 PASS, including both previously failing
  source-grounding tests. Existing jsdom navigation-not-implemented diagnostics
  are nonfailing; no Browser/E2E or runtime acceptance is claimed.
- Fresh secret scan and pnpm 11.25.0 security audit PASS; zero production
  findings, zero unapproved High/Critical, unchanged single exact approved
  dev-tool exception and five visible Moderate findings. Diff/whitespace and
  byte/scope checks PASS. No new application or validation failure.
- Delivery resumes as one ordinary integration commit and one new PR under
  SF24H-20261005, Risk R3 / Strict Change / Activation deferred. A tracking
  Issue records cross-repository Human source-review follow-up. Final head,
  remote equality, PR/Issue links, exact paths, fixed-head review and live
  Required Check results are recorded in the PR without further source edits.
- Stop remains OPEN PR after checks; no merge/auto-merge, PR #139 mutation,
  deployment, Runtime/Nginx/Production/NEW operation or migration execution.

### Human final review — initial points tab only (2026-10-05)

- Rechecked OPEN PR #141 exact reviewed head
  `64bff7d8655f6c79bc05621806668520136369b4`, protected main
  `eead719007d3483ceb4e270a431f6c591430c2fc`, auto-merge disabled and clean
  integration worktree. Same Task/Issue #140, Risk R3 / Strict Change /
  Activation deferred; no new branch or PR.
- Only Application Source change: `point-purchase-page.tsx`. The first ready
  Backend response initializes the Session-keyed tab selection: active selects
  first_purchase_users, all other states select all_users. The first-user label
  includes the 24-hour suffix only while the Backend ready state is active.
  Subsequent reads preserve the user's selection; a different Session identity
  can initialize anew. No additional qualification or countdown authority.
- Normal TOP auto-Popup is deliberately unchanged: active offers can open on
  each visit, including partial consumption with an eligible remaining product.
  No local-storage/cookie display history. Existing tests now exercise the real
  ConnectedFirstBuyHome automatic Popup, dismissal/revisit and partial-use lead.
- Changed tests only: existing first-buy contract and Point purchase UI suites.
  Added coverage for active initial products/strip, manual all-users selection
  surviving active/expired countdown refetch, expired/unavailable/anonymous
  defaults, changed Session identity, and full/partial-use automatic TOP Popup.
  Existing ordinary-product assertions now explicitly select their target tab.
- Focused: 6 files / 130 tests PASS. Full: 57 files / 1129 tests PASS, including
  all Readiness regressions. pnpm validate PASS: Artifact/policy, all nine
  boundaries, lint, typecheck, tests and production build. Secret/diff checks
  PASS; fresh pnpm11.25.0 audit PASS with production0, unapproved High/Critical0,
  unchanged exact dev-tool exception1 and visible Moderate5. A new strip test
  initially expected the Hero's shorter accessible name; corrected to the
  existing strip's exact label, with presentation and assertions retained.
- Byte comparison against the reviewed head confirmed all 641 non-change
  tracked files unchanged before this worklog append. Final delta is exactly
  one Application Source, two existing tests and this mandatory Worklog.
  Popup/Artifact/Contract/pins/pricing/countdown/Payment/3DS/Save Card/Readiness
  Inventory/classifier/workflow bytes are unchanged. No new src paths.
- Final normal commit, exact remote head and rerun Required Check evidence are
  recorded in PR #141. Stop OPEN after ALL PASS; no merge/auto-merge, PR #139
  mutation, OLD Test deployment, Runtime/Nginx/Production/NEW or migration
  execution. Browser/E2E/Runtime acceptance NOT RUN under this source-only phase.

## SFSEC-20261006 — source-map-js production remediation (2026-10-06)

- Human-approved exact dependency scope; Issue #142, Risk R3 / Strict Change /
  Activation deferred until merge and OLD Test preflight. Dedicated worktree
  starts at protected main `effe1e1fdf81e230eaeccf5901793a18b5f338a0`.
- Added only `source-map-js@<1.2.2: 1.2.2` to existing pnpm overrides and
  canonically resolved the lockfile. Version 1.2.1 is absent; 1.2.2 is the sole
  resolution. Mechanical normalized-lock comparison proves unrelated package
  delta zero, including unchanged Next 16.3.6, sanitize-html 2.17.7 and both
  existing PostCSS versions. No regression-test change was necessary.
- All 641 other tracked files are byte-identical to the base, excluding only
  package.json, pnpm-lock.yaml and this mandatory Worklog. Application Source,
  first-user behavior, alpha.43 Artifact/pins, Site Schema, Readiness, workflows,
  policy and security controls remain unchanged.
- Fresh pnpm 11.25.0 audit: production all-severity findings zero and
  GHSA-68fv-2mgg-jv7q absent. Full audit passes the unchanged canonical policy:
  one existing exact approved dev-only High exception, five visible Moderate
  findings, zero unapproved High/Critical. No new exception or suppression.
- Frozen install PASS; focused Point/first-buy/Payment regression 130 PASS;
  Readiness 258 PASS; full suite 57 files / 1129 tests PASS; Artifact, policy,
  all nine boundaries, lint, typecheck, production build, secret/scope and
  whitespace checks PASS. Existing jsdom navigation diagnostics are nonfailing.
- Existing Platform OLD Test Artifact 11384020422 exact-ID fresh readback
  verified against approved outer digest and payload 0ce41ab473fd5a4fb44773041ae097ffb40b14ce.
  Read-only preflight confirms the unchanged 80-migration ledger including
  000078/000079/000080, missing zero, healthy APIs and retained rollback sources.
  No Artifact generation, migration, operational DB or Runtime change occurred.
- Final commit, PR checks, fresh exact-head review and conditional squash merge
  are recorded in this Task PR. Human approval permits OLD Test resume only
  after every gate passes; runtime evidence is recorded separately. Production,
  NEW and PR #139 remain excluded. Human Browser Acceptance remains pending.

## PRIZERATE-RESTORE-20261006 — prize-rate OLD Test restoration (2026-10-06)

- Latest Human authorization: restore the accepted prize-rate presentation from
  OPEN/unmerged PR #137 through a new integration PR, conditionally squash merge
  only after all gates pass, then activate only OLD Test. Risk R3; Lane Strict
  Change; Application Runtime Activation immediate, limited to OLD Test.
  Tracking Issue #147 and final delivery evidence are recorded in the integration PR.
- Dedicated branch `fix/PRIZERATE-RESTORE-20261006` starts at protected main
  `76a898862f039926736ce150048984338a235d8a`. Existing occupied/dirty worktrees
  remain untouched. No dedicated worktree deletion is authorized.
- Reapplied PR #137 commits in original order as the exact 11-file patch:
  `c4d2bc6bd0dc9ee35f2b22f7d47095e492f6c7be`, then
  `2e8b324aec24603b57d95fdbb64419bc44c886c4`. Every resulting imported file is
  byte-identical to PR #137 head. Live PR state/base/head match Human authority;
  the five later main commits have no overlapping imported path.
- Parallel local-only Readiness worktree has no staged, unstaged or branch
  delta in source-inventory against current main. Mechanical tracked-src minus
  inventory equals exactly the four authorized additions: prize-rate route,
  component, presentation helper and UI test. Existing entries and their order
  are preserved. No classifier, map, policy, workflow or Readiness test changes.
- Display uses only the current is_current stage and Backend total_ppm converted
  to four decimal percent. Rank counts require show_total_stock and non-null
  stock; undisclosed Rank Prize counts stay hidden. Existing GachaDetail/client
  only; no Endpoint, Contract or generated Artifact changes. Client/Testkit
  alpha.43, Site Schema alpha.23 and source-map-js 1.2.2 remain exactly pinned.
- Frozen install, focused 37 tests, Artifact/policy, all nine boundaries,
  secret scan, lint/typecheck and exact scope/byte checks PASS. Fresh pnpm
  11.25.0 canonical audit PASS: production all-severity findings 0, unapproved
  High/Critical 0, exact approved dev-only High exception 1, visible Moderate 5.
  Full suite 58 files / 1160 tests, Readiness 258 tests and production build PASS.
  The full run includes first-user Popup/24h/countdown/points, Payment/Card/3DS/
  Save Card, Session/Wallet, Login Gacha, Draw/result/video and shipping-only
  Prize regressions. Existing jsdom navigation diagnostics are nonfailing.
  Fresh final-head audit and exact-head Readiness evidence are recorded in the PR.
- Remaining acceptance: Required Checks, fresh fixed-head self-review, squash
  merge and OLD Test canonical candidate deployment on a free port. Preserve
  existing rollback source `6aef11464215971b6aa57d10f25e78d05c424cce` and runtime.
  Technical PC/mobile and feature regression evidence is recorded in the PR.
  NEW layout comparison starts only after OLD Test technical acceptance passes.
- Platform, migrations, database, Auth/Session, Point/Payment/Card/3DS/Save Card,
  Draw/Wallet/Login Gacha authority, Production/NEW and PR #137 are unchanged.
  Source rollback is a reviewed revert; OLD Test routing rollback retains the
  prior runtime. Human Browser Acceptance remains PENDING.

## PRIZERATE-PRODUCTION-20261006 — minimal Production artifact preparation

- Human continuation authorizes only Production Authority Sync and one fresh
  canonical Storefront Production artifact. Risk R3; Lane Strict Change;
  Application Runtime Activation none. Isolated retained worktree reused;
  branch `chore/PRIZERATE-PRODUCTION-20261006`, base/runtime source
  `0d81ef59f6867fe806c0efcb0b2c77ea1d05ad7b` from merged PR #148.
- Fresh readback: Storefront protected main equals the exact Runtime Source;
  Platform protected main equals `48639e9cdc44e43534e45dbbb1b6eeb1bfc7d591`.
  PR #148 is MERGED; PR #144 and PR #137 remain OPEN/UNMERGED.
- Authority changes only Runtime Source, source PR and authorization wording.
  Corresponding two test fixtures change only their exact source SHA literals;
  provenance documentation and this mandatory Worklog record the new scope.
  Application Source, helpers, workflows, Security policy, dependencies, all
  Contract/provenance bytes and Readiness source/logic remain unchanged.
- Reuse PR #148 Required Checks, focused 37, full 1160, Readiness 258,
  production build, production audit all severities 0 and unapproved
  High/Critical 0. OLD Test Technical PASS and Human-confirmed Browser PASS
  are accepted under the latest Human decision; no local re-execution of
  those checks, OLD Test activation or browser acceptance is performed.
- Run only scope/byte/secret checks and affected authority tests locally;
  all new Authority PR Required Checks must pass without skip or bypass.
  Pending non-Required checks do not block. No same-head CI rerun is allowed.
  Fresh exact-head self-review requires SEV-0/SEV-1 zero before squash merge.
- After merge, dispatch the unchanged canonical Production artifact workflow
  once for exact Runtime Source, app name オリポケ, site https://ori-poke.com
  and API base /api/v2. Bind exact tree, authority, alpha.43 Contract and
  Platform provenance; verify native ARM64, Next 16.3.6, source-map-js 1.2.2,
  production-zero audit, exact Artifact ID/digests/Build ID, exact-ID download
  and canonical runtime smoke. Final delivery evidence is recorded in the PR.
- Platform Runtime `4b7d00e8e31223136cd0b70134916d091dfea6cb`, Platform
  Production Authority `48639e9cdc44e43534e45dbbb1b6eeb1bfc7d591`, Contract
  alpha.43 / Artifact 11349442812, database, workers, deferred Scheduler and
  ENV remain unchanged. No migration creation/application, Snapshot, NEW
  connection, Production activation, Nginx or Worker/Scheduler operation.
  activation_authorized remains false. Stop at
  PRIZERATE_PRODUCTION_ARTIFACT_READY; reviewed authority-only revert is the
  rollback path, with existing runtimes and rollback artifacts retained.
- Human requests a temporary pause after the minimal five-file authority patch.
  Work remains uncommitted on the isolated task branch. Authority PR creation,
  Required Checks, self-review, squash merge and Artifact dispatch are pending.
  Resume with affected authority tests and exact scope validation; preserve
  the accepted Runtime Source evidence without rerunning it.
- Human resumes the Task. Checkpoint bytes and both live protected main SHAs
  still match. Affected authority tests 2 files / 118 PASS; exact five-file
  scope, unchanged Application/dependency/workflow/Contract/provenance,
  exact-source-only test literal changes, whitespace and secret checks PASS.
  Accepted Runtime validation remains reused; no local Full/build/audit or
  OLD Test acceptance rerun. Issue/PR and fixed final-head delivery evidence
  are recorded through the GitHub App transport before the single dispatch.

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

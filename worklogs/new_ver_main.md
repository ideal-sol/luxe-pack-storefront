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

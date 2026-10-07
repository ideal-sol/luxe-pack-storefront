# Phase 1 Shadow Observation Ledger and Exit Evaluator

This is **SHADOW ONLY**. The maximum result is `SHADOW_EXIT_CANDIDATE`.
Production Fast Lane, Blocking Authority, CI skipping, Phase 2, promotion and
Human GO are not implemented. This tooling change uses `NORMAL_STRICT_CI` and
contributes **zero** actual changes. Application source and Platform are untouched.

## Authority and transport

Machine Policy Authority starts at approval commit
`eead719007d3483ceb4e270a431f6c591430c2fc`. Historical collection still starts
there. Operational Shadow Measurement starts separately at
`d077fb4710597ac96eb3967a3415a4f067a52f12`, whose committer date is
`2026-10-07T05:07:18Z`. Both must be ancestors of protected main. Neither start
is added to the Machine Policy AUTHORITY object or observation bindings.
Implementation merge time, collector time and PR creation time cannot replace
these starts. The two baseline changes themselves receive no actual credit.

The approved authority is pinned in `shadow-common.mjs` and verified against
the existing policy files on every validation:

| Field | Value |
| --- | --- |
| policy_version | `1.1.2-operational-approved` |
| policy_digest | `sha256:5f63edbed26a20a41e6fddde1ad74761348d45e4cfd3db611b0888bfefab938f` |
| impact_map_version | `1.1` |
| impact_map_digest | `sha256:a1bdc2acc38ad658588bbece10349e278eef419530611694b66b7bd77eca8118` |

All seals reuse `classifier.mjs`: sorted object keys, ordered arrays, compact
UTF-8 JSON, one trailing LF, SHA-256, excluding only the outer `record_digest`.
Set-like lists must have unique members; the generated machine plan's order is
preserved. Never hand-edit a sealed record. Hashes establish integrity, **not
Human authentication**. Phase 1's Source Authority is the immutable
`TRUSTED_SHADOW_EVIDENCE_PUBLISHERS = ["myong-ideal"]` in
`shadow-publisher.mjs`. CLI arguments, record bodies, snapshot allowlists,
repository permissions and PR authors cannot override it. The Human handoff
still needs a trusted Human-controlled channel and reference; the finalizer
only checks its structure and bindings. A local FINALIZED JSON is not yet
durable Human Authority and earns no Exit credit on its own.

The collector checks GitHub API `user.login` before parsing either observation
or resolution markers. Untrusted publishers are ignored as Authority evidence,
with `UNTRUSTED_HUMAN_EVIDENCE_PUBLISHER` recorded. Even malformed untrusted JSON
cannot poison the trusted stream. A trusted publisher's malformed marker, JSON,
seal, identity or publication metadata fails closed.

Publisher login, GitHub comment/review ID, exact comment/review URL, repository,
PR number, evidence kind and record digest are stored in each snapshot row's
`durable_evidence`. They are collected from API metadata, not from the JSON body.
The URL must identify that PR and match the ID and comment/review type. A record
copied to another PR is rejected. The evaluator requires this trusted durable
publication for every observation and resolution, including historical records.

Window snapshot schema **1.1** requires this provenance and separate observation
and resolution digest indexes. Old 1.0 snapshots must be reconstructed; they
cannot be upgraded by the evaluator guessing a publisher. Offline replay uses
only the sealed collector snapshot, never a caller-supplied publisher option or
a local record's `confirmed_by_role` claim. GitHub API snapshots and artifact
downloads must be obtained and retained through a trusted read-only transport.
As before, an unsigned JSON seal does not authenticate the snapshot's own origin:
do not accept arbitrary author-provided snapshots or fabricate API responses.
The offline mode replays authenticated collection evidence; it does not perform
a new network authentication or assert who physically operated the approved account.

## Record lifecycle

1. The existing classifier produces `readiness-shadow.json` without any changes
   to classification semantics or its consumer contract.
2. `observe` wraps that exact record with PR identity and `PENDING_HUMAN`.
3. A Human supplies the separate handoff below. An operator supplies exact-head
   CI evidence. `finalize` validates all input seals, identities and authority.
4. The final record embeds those three inputs and seals the derived comparison,
   plan binding and findings. Validation rebuilds the entire result, rejecting
   even a re-sealed alteration to derived fields.
5. `comment` emits canonical Markdown suitable for an authorized operator to
   post as `myong-ideal` to the target PR. It does not post anything itself.
6. Reconstruct the window after publication. Only the collector's digest-bound
   trusted publisher provenance makes that local finalization usable by Exit.

```bash
node scripts/readiness/shadow-observation.mjs observe \
  --machine /tmp/readiness-shadow.json --pr 200 \
  --output /tmp/shadow-observation-machine.json
node scripts/readiness/shadow-observation.mjs finalize \
  --machine /tmp/shadow-observation-machine.json \
  --human /tmp/human.json --checks /tmp/checks.json --output /tmp/final.json
node scripts/readiness/shadow-observation.mjs comment \
  --observation /tmp/final.json
```

All output files use exclusive creation; an existing file is never overwritten.
Do not add ledger JSON, counters or progress files to ordinary feature PRs.
Actions artifacts retain seven-day transport evidence only. The canonical sealed
record in the PR comment/review is durable operational evidence, subject to
normal GitHub retention and trusted collection. Keep an external evidence copy
when operational retention requires it. No mutable source counter is authority.

## Human handoff v1.0

Only the following top-level keys are accepted. Missing fields and extra
overrides such as `machine_policy` are rejected. For unavailable confirmation,
use the explicit pending/comparability states; never fill in a guessed PASS.

| Keys | Required content |
| --- | --- |
| `schema_version` | `1.0` |
| `repository`, `pr_number`, `base_sha`, `head_sha`, `tree_sha` | Exact machine envelope identity |
| `policy_version`, `policy_digest`, `impact_map_version`, `impact_map_digest`, `machine_record_digest` | Exact machine envelope binding |
| `confirmed_by_role` | `human_operator`, supplied through the trusted Human handoff |
| `evidence_reference` | Nonempty reference to that Human confirmation |
| `platform_impact_ground_truth` | `NONE`, `PRESENT`, `UNKNOWN` |
| `minor_eligibility_ground_truth` | `ELIGIBLE_MINOR`, `NOT_MINOR`, `NOT_COMPARABLE` |
| `actual_change_qualifier` | Explicit Human boolean |
| `change_kind` | `REAL_STOREFRONT`, `GATE_TOOLING`, `SECURITY_OR_DEPENDENCY_ONLY`, `SYNTHETIC`, `TEST_ONLY`, `DOCS_ONLY`, `CI_ONLY` |
| `critical_path`, `presentation_only_confirmed` | Explicit Human booleans |
| `focused_acceptance_result` | Object described below; cannot be omitted |
| `focused_acceptance_misses` | Unique strings describing discovered missed impact; equal to result's `missed_items` |
| `normal_ci_comparison` | `PASS`, `PROBLEM`, `NOT_COMPARABLE` |
| `fail_closed_observation` | `{status, cases, evidence_reference}`; status `PASS`, `FAIL`, `NOT_OBSERVED` |
| `human_notes` | String, optionally empty |
| `record_digest` | Seal of the completed handoff |

`focused_acceptance_result` contains exactly `plan_digest`, `planned_items`,
`performed_items`, `missed_items`, `acceptance_complete`, `evidence_reference`.
Use the machine browser plan's digest or `null` when absent. Obtain the ordered
`planned_items` from exported `plannedItems(machine)`. Each item is its machine
plan field and a content digest. This covers routes, components, focused cases,
viewports, breakpoints and states without constructing an all-state Cartesian
product. Operators inspect the embedded machine plan to interpret each item.
`performed_items` must include every planned item before acceptance can be
complete. Extra performed items are allowed; discovered unplanned impact must
also be declared in `missed_items`. A miss always creates an OPEN finding.
When the classifier produced no plan, Human acceptance still needs a separate
reference and an explicit completion decision; an empty machine plan is not a
browser PASS.

Fail-closed PASS needs explicit Human confirmation, nonempty cases and a
reference, and rejects an ELIGIBLE machine result. Cases can include dynamic
className, unknown forwarding, complex/attribute selectors, unresolved/dynamic
imports, unknown Platform impact, incomplete diff and Authority mismatch.
No observed fail-closed evidence means `INCOMPLETE`, never an implicit PASS.

Unknown Platform impact, incomplete acceptance, incomplete CI comparison or
`NOT_COMPARABLE` truth produce a finalized but **NOT_COMPARABLE** comparison,
with no actual/class/critical or FP/FN credit. Entirely missing Human evidence,
invalid Human role, missing acceptance structure or bad bindings fail validation.
Complete `ELIGIBLE` versus `NOT_MINOR` produces OPEN FP; complete non-ELIGIBLE
versus `ELIGIBLE_MINOR` produces OPEN FN. Candidate and fallback lanes are copied
unchanged; the boolean `machine_minor_candidate` has no operational authority.

## CI evidence v1.0

The sealed checks object contains `schema_version`, all five PR identity fields,
`evidence_reference`, `checks`, `record_digest`. Each check contains `name`,
`conclusion`, `source_head_sha`, `evidence_reference`. Required names are
`policy-gate`, `quality-gate`, `security-gate`, `integration-gate`, `ci-gate`,
`storefront-readiness-shadow-observation`. Names cannot duplicate. Conclusions
are `success`, `failure`, `cancelled`, `timed_out`, `skipped`, `neutral`,
`action_required`, `pending`. Missing checks and mismatched source heads fail.

Use GitHub's exact PR-head workflow-run binding for merge-ref jobs; do not label
an unrelated merge commit as the PR source. A Human PASS contradicting any
non-success normal check fails. A declared PROBLEM is retained as an OPEN
finding. At evaluation time every stored conclusion must still match the
latest collected exact-head check evidence, including reruns.

## Window collection and reconstruction

`shadow-github-adapter.mjs` is the only network adapter. The evaluator and
`shadow-window-audit.mjs` do not use Git, GitHub or `.git`. The exported
`collectWindow(get, {readArtifact})` accepts a read-only JSON GET transport and
an optional artifact-content reader. The CLI uses `gh api --method GET` with
the operator's existing authentication; it never creates credentials, comments,
reviews, branches or permissions. No write permission is needed by the workflow.

```bash
node scripts/readiness/shadow-github-adapter.mjs \
  --output /tmp/window.json --observations-output /tmp/observations.json \
  --resolutions-output /tmp/resolutions.json \
  --machines-output /tmp/machines.json --artifacts /tmp/artifact-input.json
node scripts/readiness/shadow-window-audit.mjs \
  --snapshot /tmp/window.json --output /tmp/window-audit.json
```

An optional `--responses responses.json` replaces GitHub entirely with an object
mapping **exact GET paths including query/pagination** to original API JSON.
Missing response paths fail. `artifact-input.json` maps verified artifact IDs
to objects containing downloaded `readiness-shadow.json` and, when available,
`shadow-observation-machine.json`. The caller downloads/extracts these with a
trusted read-only GitHub tool. Legacy classifier-only artifacts are enveloped
without inventing Human data. Archive filenames are data; no extracted code is
executed. A matching artifact name alone cannot satisfy observation coverage.

Collection verifies protected-main policy content, window ancestry, complete
pagination, complete changed-file counts, exact head/tree, current workflow
jobs, comments and reviews, then re-reads PR/index/main identities to detect
concurrent changes. Merged runs with an empty GitHub `pull_requests` list must
match the PR event, head SHA, head repository and branch. Snapshot sealing does
not replace this collection provenance.

The universe includes **every PR targeting main** that is open at/after approval
or closes/merges afterward. Closed-unmerged PRs are explicitly excluded from
expected checks. All other categories, including Gate and dependency changes,
still require Shadow observation; their exclusion only affects actual counts.
The offline snapshot contains all identity fields, state/dates, changed files,
workflow trigger/conclusion/source, artifact presence, verified machine/final
digests, all historical finalized digests, resolution digests, trusted publisher
provenance and normal CI conclusions. The evaluator
requires every historical finalization from that index, preventing omission of
an older OPEN finding from the supplied observation directory. It also carries completeness flags, start
authority/time, protected main SHA and capture time. `auditWindow` validates the
shape and derives rows, exclusions, indeterminate cases and skips itself.

Actual counting requires a merged real Storefront PR, Human qualifier and a
comparable finalization with current identities. Mixed application/tooling diffs
cannot be hidden by a tooling exclusion. Unknown file categories are
evaluated after explicitly ignoring accompanying `docs/`, Markdown worklogs and
root Markdown documentation; any application/public file still takes precedence.
Unknown substantive paths are
`INDETERMINATE`; Operational cases block Exit and pre-ledger cases remain visible as history. Operational open real PRs remain visible and their pending
Human finalizations block Exit; they do not yet contribute actual counts.
Pre-window workflow artifacts remain visible as transport metadata but do not
satisfy approved-window observation coverage. Before Exit, re-collect a fresh complete snapshot; no offline tool can prove a
saved snapshot is still the latest GitHub state without doing that read.

## Findings, duplicates and Exit

Identical PR/head/tree/digest reloads are idempotent. Conflicting records for the
same PR/head or observation ID fail. New heads preserve older records as STALE;
only an eligible Operational current source identity counts, while old OPEN findings remain OPEN.
Do not revise a final record in place to resolve a finding.

A collected resolution manifest is an array of separately sealed Human records:
`schema_version=1.0`, all `BINDING` fields, `observation_digest`, `finding_id`,
`status=RESOLVED`, `confirmed_by_role=human_operator`, `resolution_reference`,
`record_digest`. The original observation and finding must exist and match.
Publish each resolution as `myong-ideal` on its target PR using
`<!-- shadow-resolution:v1 -->` followed by a fenced JSON block, then re-run the
collector to obtain both the resolution manifest and matching snapshot provenance.
The publisher helper emits this canonical form without posting it:

```bash
node scripts/readiness/shadow-publisher.mjs comment-resolution \
  --resolution /tmp/human-resolution.json
```

Arbitrary local resolution JSON, including a valid seal and
`confirmed_by_role=human_operator`, cannot change OPEN to RESOLVED without its
trusted durable publication in the reconstructed window. Missing references,
wrong PR/head/observation/finding bindings, untrusted publishers and conflicting
resolutions fail. Identical resolution reloads are idempotent. Every indexed
resolution must be supplied; omitting it fails closed. A resolution never
overwrites Machine evidence or grants actual-change credit.

```bash
node scripts/readiness/shadow-invalidation.mjs --output /tmp/invalidation.json
node scripts/readiness/shadow-exit-evaluator.mjs \
  --observations /tmp/observations.json --window /tmp/window.json \
  --invalidation /tmp/invalidation.json --resolutions /tmp/resolutions.json \
  --output /tmp/exit.json
```

Observations/resolutions accept a JSON array or directory of `.json` records.
`--invalidation` and `--resolutions` are optional; missing invalidation blocks
Candidate. The controlled validator actually executes negative machine-only
probes for policy/map/machine digests, base/head/tree, stale reuse and changing
Authority. Its report binds implementation content and is invalid after a tool
change. Synthetic probes are never actual-change evidence or Human PASS.

| Formal condition | Implementation / regression |
| --- | --- |
| actual >= 5, classes >= 3 | Unique current qualifying PRs / five-PR regression |
| critical presentation >= 1 | Machine critical components plus Human eligible/presentation/critical flags |
| OPEN FP = 0, OPEN FN = 0 | Findings persist across successes and stale heads |
| fail-closed PASS | At least one explicit current-window Human confirmation; any FAIL blocks |
| CI problems = 0, acceptance misses = 0 | Separate OPEN findings and Human resolution records |
| authority reuse PASS | At least two qualifying observations with exact pinned approved authority |
| authority invalidation PASS | Executed negative-probe report with implementation digest |
| Shadow skip = 0 | Operational expected workflow, successful check and post-start verified observation |

The output has `schema_version`, `authority`, `window`, `counts`, `conditions`,
`blocking_gaps`, `status`, `record_digest` and a readable progress summary.
States are `SHADOW_ACCUMULATING`, `SHADOW_EXIT_INCOMPLETE`,
`SHADOW_EXIT_CANDIDATE`, or `HOLD_EVIDENCE_INVALID`. Invalid evidence and
incomplete operational comparisons/skips return CLI exit 1; accumulation returns
0 as a successfully calculated report, **not** a readiness decision.
Nothing consumes this exit code as a Production merge blocker or lane switch.

## Verification

```bash
pnpm exec vitest run src/test/readiness-classifier.test.mjs scripts/readiness/shadow-ledger.test.mjs
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

All new tests are under `scripts/readiness/` and run in the existing full Vitest
suite, including clean `git archive`. They do not change the packaged application
inventory. Tests create clearly synthetic Human fixtures only. Workflow changes
are limited to these tests, the pending machine envelope and artifact upload;
permissions remain `contents: read`, with seven-day retention unchanged.

Runtime acceptance is not applicable to this source/Shadow tooling change:
there is no application, Auth, Payment, Session or deployment behavior change.
Platform's existing Strict consumer remains compatible with the unchanged
classifier record. Production/Preview deployments, runtime restarts, DB,
migrations, contracts, artifact activation, merge and auto-merge are outside
this change's authorization.


## Operational Measurement extension (snapshot 1.1)

This is Storefront Minor Fast Lane Shadow measurement (formal v1.1 sections
43–45), not Gate-wide Blocking Authority Promotion (section 7.1). There is no
fixed duration or minimum Production release count for Gate-wide Exit.

Existing `start_authority`, `started_at`, `start_is_ancestor` and `authority`
retain Machine Policy Authority / historical-collection meanings. Add
`measurement_start_authority`, `measurement_started_at` and
`measurement_start_is_ancestor`. The collector reads the exact measurement
commit's committer date and checks it against the approved time. The old
`in_window`, `shadow_skip` and `indeterminate` audit fields retain historical
scope. New `operational` counts and per-row `in_measurement_window`,
`measurement_status`, `operational_observations`, `operational_skipped` and
`actual_credit_allowed` are derived by the auditor, not caller overrides.

A legacy 1.1 snapshot can be audited as history. Its
`measurement_evidence_status` is `MEASUREMENT_EVIDENCE_MISSING`; it cannot
produce Operational Exit. The evaluator emits `HOLD_EVIDENCE_INVALID`, and the
audit CLI exits nonzero. No schema 1.2 or record-format migration is needed.
Older binaries cannot interpret this extension and must not be used to evaluate
Operational measurement. Observation, Human, resolution and publisher formats
remain unchanged; all additions are covered by the existing canonical seal.

Each current row carries `measurement_evidence`: the selected exact-head
workflow run's id, event, path, source head, URL, creation/update times and
identity-bound observation descriptors. Descriptors identify artifact/run or
trusted durable observation digest, machine digest and original `generated_at`.
Only a run created strictly after the start and a machine generated strictly
after the start, within that run's interval, provide Operational coverage.
Classifier-only artifacts lack an original machine timestamp: their reconstructed
envelopes remain historical transport and earn no Operational coverage.
Artifact presence alone, updated_at alone, late Human finalization/publication
and a rerun of a pre-start run do not prove a new measurement. Such reruns need
a new run with proven timing; this minimal collector does not infer attempt
boundaries. The current-run/head and normal CI contradiction checks remain.

| Current PR case | Coverage | Actual credit |
| --- | --- | --- |
| Created after start, open/merged | Required even without observations | Only merged real comparable Human-qualified changes |
| Pre-existing PR, local checkpoint only, no fresh observation | Historical context only (unless merged after start); source boundary UNKNOWN | Zero |
| Same pre-start head with fresh observation | Allowed only with exact workflow/machine timing evidence; source boundary remains UNKNOWN | Zero actual/class/critical/actual-derived reuse |
| Pre-existing PR with a locally claimed post-start new head | Checkpoint cannot establish source timing or coverage obligation; source boundary UNKNOWN | Zero |
| Merged after start | Required; merge time alone proves no new source | Only PRs created after start can currently qualify |
| Closed unmerged | No expected workflow | Zero |
| Tooling/security/docs/test only | Required when Operational | Zero |
| Missing or ambiguous source boundary | MEASUREMENT_BOUNDARY_UNKNOWN; Candidate blocked | Zero |

The current collector has no independently machine-verifiable historical
checkpoint origin. Consequently no caller-supplied checkpoint establishes
oldSource, changedAfter, newContent or post-start source timing. Every otherwise
eligible pre-existing PR remains `MEASUREMENT_BOUNDARY_UNKNOWN`, receives zero
actual/class/critical/actual-derived reuse credit and blocks Candidate. This
also applies to a locally claimed same old head or post-start new head.
Fresh authenticated workflow/machine evidence proves observation timing only:
it can provide coverage and satisfy existing independent conditions, without
removing that source-boundary UNKNOWN. New PRs whose collected GitHub creation
time is strictly after start retain the normal qualification rules.

Exact observation identity still includes base/head/tree. Self-sealed snapshots,
PR updated_at, commit author/committer dates, current head state, first discovery
and later Human finalization/publication cannot prove head-change timing.
Timestamp ties do not prove "after". A future credit-bearing checkpoint path
requires immutable origin independently verified through authenticated trusted
transport. That transport is not implemented or implied by this correction.

### Historical checkpoints and gaps

The optional collector `--checkpoints /path/to/prior-snapshots.json` accepts an
array of structurally valid snapshots as **non-credit historical context**,
including legacy 1.1. Caller claims of trusted origin confer no Authority.
`collectWindow(get, {checkpoints})` provides the same input offline. Before use,
the collector validates each original seal, repository, approved Authority,
complete index, identities and provenance; future captures are rejected.
Those checks establish structure and integrity, not authenticated historical
origin. Neither a canonical SHA seal nor an evidence URL grants source-timing
Authority. Measurement eligibility never reads these checkpoints. Preserve
authenticated API transport and original snapshots externally; no caller flag
or locally constructed snapshot enables credit.

The current snapshot's `historical_rows` retains original PR rows, capture time,
source snapshot digest and evidence reference, including missing observations
and indeterminate categories. Repeated identical inputs are deduplicated.
These are retained historical context, not machine-authenticated historical
facts or newly finalized observations. The source digest is a reference, not a
signature or origin proof. Current history indexes must still include all older finalizations
and resolutions. Omission fails closed rather than silently deleting findings.

Known pre-ledger gaps such as #137/#139 and historical indeterminate #146 stay
visible; there is no PR-number exclusion allowlist. If their earlier identity
state is not available in trusted evidence, retain UNKNOWN. Current API data
must not be backdated into a checkpoint or used to invent a past gap/PASS.
Retain previous snapshots when collecting so head transitions do not erase gaps.
Historical gap counts are displayed independently of Operational skips; the
former never become newly measured successes or new skips solely due to start.

The evaluator validates all observations, trusted publication and historical
completeness before selecting `operational_current` and `qualifying`. Findings
remain global across the boundary and stale heads; only an existing exact-bound
trusted resolution closes them. Historical fail-closed FAIL also remains a veto.
Positive fail-closed evidence, finalization and actual-derived reuse require
Operational records. Invalidation remains bound to implementation content and
must be regenerated after this Source change. It grants no actual credit.

### Limits and rollback

The existing evaluator's three-class count does not select Promotion classes;
per-target-class samples still require separate review. Existing all-OPEN-FN
blocking, two-qualifying-record reuse and single explicit fail-closed confirmation
retain their limited meanings; they do not establish all formal Boundary/UNKNOWN
fallback checks or Gate-wide readiness. No automatic Promotion, Fast Lane,
Blocking Authority, Phase 2 or Production Human GO is introduced.

Rollback is a reviewed Source/configuration revert, retaining every snapshot,
observation, resolution and finding. Suspend use of the affected Operational
Candidate output; an old evaluator's authority-window counts are not replacement
Operational results. No Runtime, deployment, DB, ENV, Contract or Artifact
activation/migration is involved. Existing application and workflow are unchanged.

# SF226-PRODAUTH-20261106 — PR226 Production Authority Draft

Risk R3; Lane: Strict Change; Application Runtime Activation: none.
Draft preparation only. Prior Authority PR225 / 7c8085c22754464164e1694706c14ac6f9bed9ba
is replaced only for Storefront Source selection: PR226 / GTM-REG-20261106,
Merge 8e9df3501e5451523a56e57aa1149e6290b92aee, approved HEAD
928ce84156dad0edf51a6dbb9a4aa7220cca1b13, reviewed/merged Tree
e6c11382199c63f51c1770bf7c1d0ff63654d427. Tree equality/content diff0 checked.
Scope: registration_complete UUID/optional hashed email and purchase_complete
UUID/hashed email/payment amount/payment UUID attributes already merged in PR226.
Application Source, scripts/production-provenance.mjs, workflows and security
guards unchanged. Existing source/PR/reviewed-tree/check and negative tests retained.
Platform Runtime cad8be03cbab8b7fba18825a4a9b2a276f402010, Platform Authority
8eadec09a187e3f220dc09d36e9a14b98511931b and Contract publisher
14f7819c72c5908aa6e5778303b87dc4b1202493 unchanged. Contract alpha.50,
Artifact13324454382, Manifest bbf4284afc47d912a13b039b7a3168fc09ae58ace682c005ef46d852e0b9c44a,
Vendor/Client/Testkit/package/lock and all digests unchanged.
GTM-5DQRPNN2 is already enabled in NEW Production; no ON operation, container
creation/publication or ENV change. activation_authorized=false unchanged.
Dedicated Worktree isolates existing dirty checkouts and OLD Test work. OLD Test
PR226 final Technical PASS pending; no acceptance inferred. OLD Test GTM OFF,
Runtime/Artifact/settings unchanged. No NEW server connection, Ready, Merge,
formal Artifact Build/Dispatch, Stage, Runtime/ALB/API/Admin/Agency/DB/Migration/
Worker/Timer/F2-B/ENV/Secret operations. Migrations created0/applied0.
Reuse unchanged PR226 source/focused/compiled-build evidence; no local Next Build,
full E2E or Contract republication. Required CI runs normally without manual rerun.
Focused validation and final-head Strict self-review/CI results are recorded in
this Draft PR after HEAD is fixed. Human must separately approve Authority merge,
formal Artifact creation and Runtime cutover after OLD Test final result.
Rollback now: abandon Draft with no runtime effect; later use reviewed Authority revert.

Prior authority records below are historical for Storefront Source selection.

---

# SF-PR666-20261105 — Platform limited-payload Authority follow-up

R3 / Strict Change / Activation none. Draft only; Storefront Ready/Merge requires separate Human approval.
Platform PR669 was canonically squash merged at 8eadec09a187e3f220dc09d36e9a14b98511931b from approved head3eee947ba34a6af55a1c396dbb14bb4032d14127. Reviewed/merged tree fdb97af9cba6e22ae598860812818768d23eecf1; content diff0; Required5 and fresh Strict review reused, SEV0/1 zero.
Platform Runtime source cad8be03cbab8b7fba18825a4a9b2a276f402010, tree0978c97a3a1d90036f5173aff4409398b93c5a87, inventory a98161e34cf90e8b075fbdf9b25812cde884577846c33c7a292676b1facaf4f1. Only two PR666 normalizer blobs are added to alpha50; full PR666/latest main are excluded.
Storefront source remains PR221 1e3ba92780825a12485f651ea79025ad47f1321b. Contract publication source platform_source_sha remains 14f7819c72c5908aa6e5778303b87dc4b1202493; immutable alpha50 Artifact13324454382 and all Vendor/package/lock digests remain unchanged. Source authority is separate from actual activation, which is not authorized.
OLDTEST_PR666_API_ONLY_RUNTIME_TECHNICAL_PASS: https://github.com/ideal-sol/oripa/pull/668#issuecomment-6662848658. Active API OCI derived SHA matched and complete tree/inventory/two-file composition independently reproduced against pinned PR667 specification. Original handoff reserves authenticated detail and browser CDN acceptance for Human; do not invent acceptance. No OLD Test runtime was changed here.
No formal Artifact Build/Dispatch/Stage, Production connection or Runtime/ALB/ENV/DB/Migration/Worker/Timer operation. Migration scope104 ->105 ->106 unchanged; created/applied operational migrations0. Rollback: abandon this Draft without runtime effect, or reviewed authority revert before later separately approved dispatch. Dedicated Worktree protects existing dirty primary checkout; no active source collision or allocation lock.
Final focused tests, CI and fixed-head review results are recorded in the PR after fixing HEAD. No local application Build or Browser/E2E is claimed; ordinary CI remains required.

The following alpha50-only authority records are historical and superseded by the exact pins above.

---

# SFAUTH-20261105 — alpha.50 Authority / Human merge HOLD

Risk R3; Lane: Strict Change; Application Runtime Activation: none.
Platform PR #664 was explicitly approved and canonically squash merged at
5ade57a7d40830a2cf137552f242a2001724b295. Reviewed HEAD
0df3c3a9c995bad6b1fad27106d565230d3f19f4 and merge share tree
4d84b1dc0b58db326530f1e2d75345109460f161; content diff 0. Required CI 5/5
and fresh self-review were reused with no rerun. This is Authority approval only.

Storefront Runtime remains PR #221, Source 1e3ba92780825a12485f651ea79025ad47f1321b,
Tree 15139d5713b9c17c50c39b017f68720984632a58. Platform Runtime remains PR #659,
Source 14f7819c72c5908aa6e5778303b87dc4b1202493,
Tree 1a2a4cf3fa30c39c6903d11472c7e8c63a69168c. Authority/Workflow commits
are distinct; later main must never replace these application sources.

Contract Artifact 13324454382 / Run 41835790272, Client/Testkit alpha.50,
Public/Admin alpha.46, Webhook alpha.45, Site Schema alpha.23 are immutable.
The authentic PROVENANCE.md format is pinned by SHA256
127bf11031339951d2703a2f9da4a4d34600b054283c9737ff37ee668a5685d2;
this binds its artifact URL, run, archive, source, versions, ledger and declared
digests without translating it to alpha.48 syntax. SHA256SUMS is also pinned;
manifest, package/OpenAPI actual bytes and package/lock pins remain checked.
The formal manifest digest is fixed even when caller metadata supplies a changed
digest. No Vendor/dependency/lockfile rewrite or Contract republication.

Preserve current Production UnivaPay LIVE, seven-day automatic exchange ON,
Rank ON/Generation1 and existing settings/history. Never restore historical
TEST/OFF settings. Future Platform migration sequence 104 -> 105 -> 106;
no migration created/applied here. Reuse Human-reported
OLDTEST_ALPHA50_RUNTIME_TECHNICAL_PASS, with no newly claimed Browser acceptance.

Only this Storefront Authority Draft PR is authorized. Separate Human approval
is required before Storefront merge. activation_authorized=false; neither
Authority merge authorizes Production Build/Dispatch/Stage or Runtime GO.
No Production connection, ENV/Secret/DB/Worker/Timer/ALB change or activation.
No API/auth/payment/point/draw implementation or application source changes.

Dedicated worktree isolates existing work. Exact-path transient wrapper policy
has no merge/ready/build permission. Issue tracks cross-repository approval and
is required by the installed canonical transport schema. Source/Migration locks
not needed: no collision or allocation. Rollback is a separately reviewed
Authority revert; runtime remains untouched. Focused tests cover valid pins,
old/missing/duplicate/changed provenance, SHA256SUMS, metadata and byte mismatch,
current-main substitution, reviewed-tree mismatch and forged/failed checks.
Required CI and final-head review results will be recorded in the PR. No local
application build or Browser/E2E; ordinary existing CI builds remain required.

All records below are historical and cannot restore superseded Production settings.

---

# Production Source Authority — alpha.48 (Human Source GO received)

SF-A48-PRODAUTH-20261028 / Issue #197. Risk R3; Lane Strict Change;
Application Runtime Activation: deferred. Human Source GO authorizes PR #198
formal Source Authority promotion, validation, Ready and Canonical Squash Merge.

The approved Storefront Application Runtime Source is
`cc398cc4d943f4a426fa9540cc6258edf9bc5208` (PR #196, PR #194 ancestor),
Tree `3171e03344299c9ad84c1c1e4adc1f766e5f00a3`. Platform Application Runtime
Source and Contract publication source are both
`6e945df343d3d42ffa844b3b369ca0c171a6bbbe` (PR #631), but are separate identities.
Platform Production Authority PR #635 is formally merged at
`1086d776cb2ca20f20883b3e8fa5578510bdce67`; this exact SHA is pinned in
metadata and Provenance validation, independently of the Runtime Source.
Contract Client/Testkit alpha.48, Public OpenAPI alpha.44, formal Artifact
`12819254428`, publication run `40697440380`, Manifest SHA256
`9affb95def4858a748a5343614dcdf4d8e0ca20705d5d227cc48e976f01df60f`,
and Outer Archive SHA256
`0d2606a8a5b4e282f183bae0484b3b9bc2212b74a91c176a41f59ee6cffba897`
remain immutable. Existing vendor bytes, dependency pins and lockfile match;
no Contract republication or rebuild is performed.

The formal `Human-approved exact Runtime Source:` prefix is used with unchanged
Canonical authorize, exact Source/PR/reviewed Tree/current protected main/checks.
`activation_authorized=false`. Incorrect, superseded, malformed and unresolved
Platform Authority SHAs fail closed. OLD Test alpha.48 Technical PASS and Browser
completion are Human-reported; individual Browser operations/items/timestamps
were not provided and are not independently verified here. No evidence is invented.
Artifact Dispatch/Build, Stage, Runtime, Migration, DB/AWS, ENV and production
Payment/Rank/GTM setting changes remain unapproved and require separate Human GO.

Historical Draft preparation used the rejected Draft prefix and unresolved
`PENDING_HUMAN_SOURCE_GO` placeholder. This formal promotion supersedes those
current-state expectations; historical Draft Worklog entries remain intact.

NEW Production Rank first initialization remains OFF/unperformed. Feature
enablement is a separate read-only observation; preserve existing flags and all
rank, point and bonus data. Human-shared NEW operator READ ONLY readback confirms
feature `enabled=false`, `activated_at=null`, first Activation unperformed,
14 Rank tables each0 rows, migration ledger98 with099/100/101 pending. GTM ON
and FINCODE enabled=true/config unchanged are preserved. This is attributed to
the NEW operator report; this Authority task makes no direct NEW connection.
No first Activation, initialization or Backfill is
authorized. OLD Test Rank ON must never be a Production prerequisite.
Migration099/100/101 planning and Production read-only Rank observations belong
to the independent Platform preparation; this Site change performs no DB work.

GTM-5DQRPNN2 remains enabled at formal Build time. All five reviewed GTM Source
file digests are unchanged from PR #186, so no Source verifier change is needed.
Actual compiled loader/noscript/SMS event verification, Build ID, artifact ID,
digest, package and exact-ID re-download checks remain intact. Next.js16.4.2,
ARM64, Required Checks, Security and rollback assets are unchanged.
The CDN Build-output guard admits the candidate's exact27-entry Brand Manifest
bytes (`2e563e6ef9e1a5f46ed5c8ac8593f383869858ed7ab56100f8d945992b3d76fe`),
including two payment logos, while retaining23/25-entry rollback authorities.
Existing23 object prefixes and preregistration25 prefixes stay fixed. Unknown,
tampered or malformed manifests still fail closed. This is Source conformity
preparation; CDN object delivery/readiness remains a separate pre-Build gate.
No actual Production Artifact, GTM-ON compiled-byte observation, CDN delivery PASS or Browser verification is claimed by this Authority merge. Preserve F2-B Timer, Agency/Redis and existing FINCODE configuration; Migration101-dependent Mail Workers belong to a separate Runtime scope.

## Historical alpha.45 and alpha.44 records

The following records describe historical approvals; current Source approval is above and Runtime permission remains separate.

# Production release authority — alpha.45 (historical)

SF171-PRODAUTH-20261020, following SITEPRODAUTH-20261019.
Risk R3; Lane Strict Change; Application Runtime Activation: deferred.
Human GO permits the gated Authority Squash Merge and canonical Production
ARM64 Artifact generation for PR #175, including PR #171's copy change and the
Human-approved sanitize-html 2.18.1 / Vite 8.2.4 security remediation. Runtime Activation belongs to the NEW
Production operator and is not executed by this task. No migration or settings
changes are included. PR #171 OLD Test Human Browser Acceptance is reused;
P2 remains phase=health/HOLD, not formal Technical completion, and Human has
confirmed that this is non-blocking for the existing NEW Production gates.

## Current exact authority

- Storefront application: `dcde7c91926d725a69b305e7bd9cc9b48d5d4fe6`, PR #175; PR #171 is an ancestor.
- Platform runtime: `b5c28015ef94cb80f6702a61b1237cacd91d9863`, PR #574.
- Platform Production Authority: `8f9f9a8c9181361a6cbc540b54ddc476ad7fc9d1`, PR #591.
- Published Contract source: `c4efbee32a7846bc94f7375d0d5f71779aa0ac77`.
- Client/Testkit: `2.0.0-alpha.45`; Artifact `12031381227`.
- Publication: workflow run `38866011951`, attempt 1, success.
- Public/Admin OpenAPI: alpha.41; Webhook: alpha.40; Site Schema: alpha.23.
- Manifest: `vendor/oripa/PREREG-V14-20261016/artifact-manifest.json`.
- `activation_authorized=false`; latest main is control authority, never an
  automatic substitute for the fixed application source.

| Current authority | SHA-256 |
| --- | --- |
| Outer ZIP | `19472639f0fa5afe1aa14663d93587f19f28df8f79e0fa784621d2dffc4054d2` |
| Manifest | `0fd03ceb42cf316fc01de0c9757ee20be3bc1242b25cd52bc20870c50c2ce3a5` |
| Client | `4a78f26395807fd0eff231249c9f2547d416de4a439309605fee9cd903433c4e` |
| Testkit | `8e6577375c864a0681aa475ee39c6c7a0958bc09c754a92cd1252f543b9b2a7a` |
| Public OpenAPI | `9fc089b11f70bc0f3e70d44e41c1ec4b32c7479b6ec24410d0481d45f5b6401f` |

The retained alpha.45 `PROVENANCE.md` uses these exact records:

```text
Artifact ID: 12031381227; oripa-storefront-contract-2.0.0-alpha.45.
Publication: https://github.com/ideal-sol/oripa/actions/runs/38866011951, attempt 1, success.
Outer ZIP SHA256: 19472639f0fa5afe1aa14663d93587f19f28df8f79e0fa784621d2dffc4054d2.
```

The strict parser requires exactly one declaration of each type and exact
Artifact/bundle, publication run/attempt/result and archive hash. Missing,
duplicate, conflicting or malformed records fail closed. Old alpha.44 formatting
is not a fallback. Manifest, package bytes, dependency/lockfile pins, OpenAPI and
Platform runtime/authority checks remain strict. Vendor, lockfile, packages,
GitHub check authority and Security policy are unchanged by this task.

## Future Build inputs and activation gates

After the gated Authority Merge, use the approved canonical Production workflow with:

```text
source_sha: dcde7c91926d725a69b305e7bd9cc9b48d5d4fe6
app_name: オリポケ
site_url: https://ori-poke.com
asset_public_base_url: https://d2c0gdzoj8l46h.cloudfront.net
static_asset_base_url: https://d2c0gdzoj8l46h.cloudfront.net/static-assets
```

Brand inventory is 25: existing23 plus2 preregistration assets. S3/CloudFront403
for the new2 remains unresolved, not proof of absence and not delivery PASS.
Resolve it before Activation; do not overwrite existing23 or enable S3 Object GC.

NEW F2-B is already ON and Production Accepted. Preserve its storage generation,
destination, URL purge and retention; follow the separately approved Platform
runner image-pin/drain plan for a future API update. F6 and general Scheduler
stay OFF. Migration target is000087;000088 and later and member rank are excluded.
No migrations or Source/Contract republication occur in this task.

Preregistration initially remains OFF after Source reflection. Human alone sets
the deadline and enables受付 in Admin after Production reflection, controls
Basic/public scope, then performs Browser Acceptance. Never copy OLD Test受付,
deadline or Basic settings.500pt grants/batches require separate approval and
Acceptance; neither deployment nor受付ON triggers them automatically.

Local checks, GitHub Required Checks, Preview/Browser Acceptance, Artifact Build
and Production Activation are separate results. Keep final-head self-review
fresh before merge. Stop at verified Artifact handoff; no Runtime/DB/ENV/AWS/Worker changes.

## Historical — alpha.44 authority (superseded)

The following original record is retained as history, not current authorization.
Its F2-B OFF, migration85/86 exclusion and unresolved CDN-build statements do not
override the current alpha.45 authority and operating policy above.

PRODPARITY-SF-20261015 implements Human decision PRODUCTION-OLDTEST-PARITY-20261015.
Strict Change; Application Runtime Activation: none.
Candidate: PRODUCTION-OLDTEST-PARITY-20261015-CANDIDATE-01.

## Separate exact runtime and control authority

- Storefront runtime: `763cd4bb8fabdadce7822a59e8718ef2381394dc`, PR #159.
- Runtime tree: `979a54f5684d84d75d6da685bfc9d3fef9d1d836`.
- Platform runtime: `aef1759d072dab48be4b052d53e2ef969feddd9f`, PR #566.
- Platform Production Authority: `cba63981e443992d7b4f9ebcd0ee219dce38c0f9`.
- `activation_authorized=false`; the authority merge is control-plane only.

Current main must never replace the approved application source. The unchanged
canonical workflow checks out control and runtime separately, with Required
Checks and reviewed-tree gates. Failed current checks never fall back.
RANKVIDEO-MULTI and Migration 000086 are excluded from Platform runtime.

## Immutable Contract

Client/Testkit alpha.44, Artifact 11745799489, workflow 38247721027, Contract
source `8f4c79d2964186f704f14f4ddc2af228bf1047c9` (PR #555).
Manifest: `vendor/oripa/SIGNUP-SMS-GATE-20261012/artifact-manifest.json`.

| Authority | SHA-256 |
| --- | --- |
| Outer ZIP | `63388a1fcf0b6d7105834d074d947123fe865036de55541193c7bb8dd08715ac` |
| Manifest | `1b12edfd6ddf54fca221a45cd3be4181861f5b49b3b8eba2f5c5aba45b42c692` |
| Client | `49d8026b1bc21f641b3c36f53f88cb0b620d7e45dd80ad9e7d95e5124001ce80` |
| Testkit | `0b7865beacc4a37202549b0b30d2068f4db1ea84c28bd9628e8be5094d15d99e` |
| Public OpenAPI alpha.40 | `0041ff6a99f4bfb9c162a434d14c8924aa6763e8c81e7a3933e079e189366d1c` |
| SHA256SUMS | `587c17804f4c3a45acfcbf58cf280a68a390760a716d5ab0704449b44de8ad77` |

Site Schema alpha.23 is unchanged. Vendor bytes, package pins and lockfile are
not changed, rebuilt or republished. The strict parser follows the existing
alpha.44 Workflow line and Outer ZIP table row, requiring one entry and exact
approved values. Historical alpha.43 and older pins fail closed.

## Evidence reuse and build

Human-authorized exact-source OLD Test, CI, Security, SMS receipt, SMS phone
reentry Browser and S3/CloudFront evidence are reused without repeat deployment,
Full validation or Acceptance. F5 Technical PASS is reused; F5 Human Production
Browser confirmation remains pending. F2-B and F6 remain OFF in Production.

Required Checks and fresh exact-head machine-readable self-review with zero
SEV-0/SEV-1 remain mandatory. Pending non-Required observations alone do not
block; completed Security/Authority/SEV-0/SEV-1 failures do block.

After merge, dispatch production-artifact.yml once with exact runtime, app name
オリポケ, site URL https://ori-poke.com and API base /api/v2. Preserve Next 16.3.8,
Node 22.22.3, pnpm 10.12.1, isolated audit pnpm 11.25.0, native ARM64 smoke and
exact-ID re-download. Security policy, thresholds, exceptions and workflow stay
unchanged.

The canonical workflow does not bind CloudFront build inputs. This preparation
does not invent a Production CDN origin or copy OLD Test settings. Production
CDN activation/build-input suitability remains to resolve before activation.

## Boundaries

No NEW/Production connection, DB, AWS, ENV, Runtime, Worker or Scheduler operation.
No Migration execution; target ledger is 85 and 86 is excluded. Production
routing, payment and topology are not copied from OLD Test. Stop after artifact
verification. Existing runtime and rollback artifacts stay untouched; authority
rollback requires a reviewed revert.

# Production release authority — alpha.45

SF171-PRODAUTH-20261020, following SITEPRODAUTH-20261019.
Risk R3; Lane Strict Change; Application Runtime Activation: deferred.
Human GO permits the gated Authority Squash Merge and canonical Production
ARM64 Artifact generation for PR #171. Runtime Activation belongs to the NEW
Production operator and is not executed by this task. No migration or settings
changes are included. PR #171 OLD Test Human Browser Acceptance is reused;
P2 remains phase=health/HOLD, not formal Technical completion, and Human has
confirmed that this is non-blocking for the existing NEW Production gates.

## Current exact authority

- Storefront application: `0c39f94b963b3890ae4384fc19027268bd6bb93f`, PR #171.
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
source_sha: 0c39f94b963b3890ae4384fc19027268bd6bb93f
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

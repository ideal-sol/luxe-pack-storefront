# Production release authority — alpha.44

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

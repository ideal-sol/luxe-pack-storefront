# Production release authority — alpha.40

Authority/provenance preparation only. Application implementation is Human
accepted. Production Build dispatch and Production Activation are not authorized
by this change; `activation_authorized` remains false.

## Separate runtime and workflow sources

The approved Storefront Runtime Source is
`b85afec9aba0e72732366e8e12701cef39a06e06` (merged PR #117; includes #115 / #116 / #117).
The Platform Runtime Source is
`e4361ece51fc1249a5cfb2c64cf56d3aa4bb0c29`.
The Platform authority merge is
`d823c2f80c1500990289b06da8e5504d7b48c2e5`.
Contract Artifact Source remains
`dadf79f3b0b2409a57e41b10a83c7b6570ea3507` (`platform_source_sha`);
it is distinct from `platform_runtime_source_sha` and is never rewritten to the
Platform Runtime Source. Both authorities propagate into build provenance.
The authority PR's merge SHA is workflow/metadata authority only and must never
replace the approved Runtime Source.

The existing `production-artifact.yml` accepts explicit `source_sha`. Its
workflow and approval code come from protected current main, while the separate
Runtime checkout remains the exact approved source. Both Source PR and current
workflow Required Checks must pass; empty squash checks are handled only with
the merged internal PR, identical reviewed/merge trees and reviewed-head checks.
Failed current checks never fall back to another commit. The workflow is unchanged.

## Exact contract authority

`production-approved-source.json` records the Human-approved exact source and
Platform's final canonical alpha.40 authority. The source must exist, be an
ancestor of protected main and match the metadata; free-form dispatch input
does not authorize another source.

Client and Testkit are `2.0.0-alpha.40`, from immutable Artifact `10845475225`.
The manifest is `vendor/oripa/DRAW-20260925/artifact-manifest.json`.
Public OpenAPI has its independent version `2.0.0-alpha.36`.
The manifest, Client, Testkit and Public OpenAPI SHA-256 values in the approved
JSON are the exact Human-supplied Platform authority. Artifact bytes are checked
against those values; computed digests never replace the approved values.

The verifier checks source package/lockfile pins, immutable manifest identity,
Platform source, Client/Testkit alignment, one canonical Artifact ID declaration
and every approved digest. DRAW provenance uses `Artifact ID:` on its
canonical workflow line; missing, duplicate or mismatched declarations fail.
The Public OpenAPI version is checked independently. The outer archive digest
`3c5b35542cdaf7ed636aa0e7376e39d96463115ea14600c293d30d011e70b0e9`
is bound to the existing canonical provenance declaration; this sync reuses the
Human-supplied canonical archive readback and does not download or reissue it.
Validated fields propagate into Build metadata and are checked before publication
and after re-download. Alpha.39, old sources, arbitrary/nonexistent SHAs, mixed
packages and wrong IDs/digests fail closed. Historical vendor bundles and
predecessor references are retained and confer no Production authority.

## Validation and rollout boundary

Focused provenance/workflow tests cover the exact authority and rejection cases.
Artifact, policy, security and lint checks run locally; all five existing Required
Checks, including CI's automatic application tests/build, must pass on the final
PR head. A fresh machine-readable self-review binds that same head and exact paths.
Storefront has no dated Security/ESLint baseline files or expiry/refresh mechanism;
its canonical evidence is the current security/quality gates, not Platform's
baseline dates. CodeQL default setup is not configured in this repository.

After Squash Merge, validate approved provenance against the exact Runtime Source
and run the authorization function using live protected-main, merged-PR and check
readback. This performs no Build or workflow dispatch. The metadata merge must
have zero application, dependency, ENV, Secret or migration delta from the
approved Runtime Source. Application Runtime Acceptance is already Human accepted;
no additional Runtime E2E or activation is part of this authority-only change.

Production Build dispatch, artifact placement, service restart, traffic changes
and new-server operations remain NOT RUN. Rollback is a reviewed metadata/verifier
revert; this change performs no application or database rollout.

## Latest approved runtime delta (2026-09-25)

From prior approved source `c911155f2fff5aea0f0b3df4f3184aa4081b6203`,
#114 updates authority only; #115 changes Top/Navigation; #116 adopts the approved
alpha.40 Client/Testkit and representative presentation; #117 fixes fullscreen,
audio autoplay and presentation flow. There are no other intervening commits.
The package/lockfile delta contains only that approved contract adoption, with
no unexpected runtime dependency change. Unapproved Runtime delta: NONE.
Migration: NONE. ENV: NONE. Old Test Technical and Human Browser Acceptance are
already PASS per Human authority and are not rerun by this provenance sync.

This sync changes only authority metadata, its verifier, focused tests and this
document. Runtime Application delta: NONE. Dependencies: NONE. Secret inputs:
NONE. The canonical ARM64 production workflow is unchanged. Read-only acceptance
of the target is authorization/provenance proof, not a Production Artifact Build.
Subsequent planned activation covers Storefront and API only; Admin, Contact Reply
Worker, Identity, SMS, Agency and Scheduler are out of scope. No activation occurs
in this change.

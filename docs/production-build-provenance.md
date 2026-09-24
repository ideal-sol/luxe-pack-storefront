# Production release authority — alpha.39

Authority/provenance preparation only. Application implementation is Human
accepted. Production Build dispatch and Production Activation are not authorized
by this change; `activation_authorized` remains false.

## Separate runtime and workflow sources

The approved Storefront Runtime Source is
`c911155f2fff5aea0f0b3df4f3184aa4081b6203` (merged PR #113).
The Platform Runtime Source is
`be1a8f3f822d23f3251d32e616fb0b2fe422714e`.
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
Platform's final canonical alpha.39 authority. The source must exist, be an
ancestor of protected main and match the metadata; free-form dispatch input
does not authorize another source.

Client and Testkit are `2.0.0-alpha.39`, from immutable Artifact `10800178238`.
The manifest is `vendor/oripa/PRIZEIMAGE-20260924/artifact-manifest.json`.
Public OpenAPI has its independent version `2.0.0-alpha.35`.
The manifest, Client, Testkit and Public OpenAPI SHA-256 values in the approved
JSON are the exact Human-supplied Platform authority. Artifact bytes are checked
against those values; computed digests never replace the approved values.

The verifier checks source package/lockfile pins, immutable manifest identity,
Platform source, Client/Testkit alignment, one canonical Artifact ID declaration
and every approved digest. PRIZEIMAGE provenance uses `Artifact ID:` on its
canonical workflow line; missing, duplicate or mismatched declarations fail.
Validated fields propagate into Build metadata and are checked before publication
and after re-download. Alpha.38, old sources, arbitrary/nonexistent SHAs, mixed
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

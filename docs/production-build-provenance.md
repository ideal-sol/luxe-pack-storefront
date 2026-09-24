# Contact Production Build provenance

CONTACTBUILD-002: R4 / Strict Change / Application Runtime Activation: none.
Build-path preparation only; no Production artifact generation or activation.

The existing `production-artifact.yml` accepts explicit `source_sha`. Its
workflow/approval code comes from protected current main, while the separate
Runtime checkout remains the exact approved source. Both Source PR and current
workflow Required Checks must pass; empty squash checks are handled only with
the merged internal PR, identical reviewed/merge trees and reviewed-head checks.
Failed current checks never fall back to another commit.

`production-approved-source.json` records the Human-approved exact source and
Contract authority. Free-form dispatch input does not approve a different SHA.
The source must exist, be an ancestor of protected main and match that metadata.

The verifier derives package paths from source's exact package/lockfile pins,
checks the corresponding immutable CONTACT-PREFILL-001 manifest, Artifact ID
and approved manifest/client/testkit/OpenAPI digests, then copies those validated
fields into Build metadata. Packaging and re-download check the same fields.
It rejects alpha.36/37, stale AGENCY-004A authority, mixed packages, wrong ID,
wrong digests, source/manifest mismatch and unapproved sources. Retained
historical vendor artifacts remain subject to the existing artifact integrity
check, but supply no Production provenance. No dependency or package bytes change.

Contract bundle, Client and Testkit are alpha.38. Public OpenAPI's own version is
alpha.34; its approved digest is verified. No Contract version is downgraded.

PR #110 final/reviewed/pre-merge head is
`68c4a869655797189d8f928c65290f7c81f9fc0c`; its five Required Checks passed in
[run 35947415604](https://github.com/ideal-sol/luxe-pack-storefront/actions/runs/35947415604).
The [exact-head self-review](https://github.com/ideal-sol/luxe-pack-storefront/pull/110#issuecomment-5806420179)
matches. Reviewed and approved squash `342341a82131a7f80a4e7508172f1e764ec7ad84`
share tree `eb6a989bfe037e07574661db7046c68c205371f9`; direct diff is zero.
Those checks do not need rerunning for historical source acceptance.

The existing application checkout overlays are excluded from this Change.
Focused provenance/workflow tests, lint/typecheck, artifact/policy/security
checks and all final-head Required Checks gate merge. Runtime/ENV/migration/mail
operations and canonical Production workflow dispatch remain NOT RUN. The next
Human step after merged technical acceptance is Production Runtime Artifact
Build GO. Rollback of this preparation is a reviewed workflow/metadata revert;
there is no application or database rollback to perform.

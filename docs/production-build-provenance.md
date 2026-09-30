# Production release authority — alpha.41

Authority/provenance synchronization only. Human approved exact Storefront Runtime
Source `7da93eb695f38b7cf804eba59a3642da0b9dc073` (merged PR #126), with OLD Test
Technical, Human Browser Acceptance and Security Production Acceptance PASS. Production Build dispatch, new-server
operations and Production Activation are not authorized by this change.
`activation_authorized` remains false.

## Separate runtime and workflow sources

The approved Runtime Source stays `7da93eb695f38b7cf804eba59a3642da0b9dc073`.
The authority PR's merge SHA is workflow/metadata authority only; it must never
replace the approved Runtime Source. The canonical `production-artifact.yml`
remains unchanged: approval code comes from protected current main, while the
application checkout uses the exact approved source.

Both the Source PR and current workflow authority require successful checks.
Empty squash checks are accepted only through the merged internal PR, identical
reviewed/merge trees and successful reviewed-head checks. Failed current checks
never fall back to another commit. Missing or arbitrary source approvals fail.

## Exact contract authority

The existing immutable `vendor/oripa/SHIPONLY-20260926/PROVENANCE.md` and manifest
are the canonical alpha.41 readback. Their original bytes are unchanged.

- Client/Testkit: `2.0.0-alpha.41`.
- Artifact ID: `10900150259`; canonical workflow: `36223277643`.
- Manifest: `vendor/oripa/SHIPONLY-20260926/artifact-manifest.json`.
- Manifest SHA-256: `b3c7d2a28c0c8332eeea90ac43876245baf4a1e4ce6b7d4f646124212d99f7ee`.
- Client SHA-256: `3565505ed851df91a1ee4b9eeef1a94caae706a6b47725ef1472e5d5048f6f72`.
- Testkit SHA-256: `56892eafca206e8f504144937169a7ed2974da6f14082347616abafda013bd59`.
- Public OpenAPI: `2.0.0-alpha.37` (independent version).
- Public OpenAPI SHA-256: `2ef9d4d085ad29e4073f6e963d93b68b9e1ecfd8000dc84a330a8a016f30be4b`.
- Outer archive SHA-256: `6d4cf321249d46145f22ce9551ba709a51dd59453ccbe0bd5004d0782d2dfb50`.
- Contract Artifact Source: `e2b30805704ed5b9c3fd54492fb86f8b8549bde5`.

The manifest/package/OpenAPI bytes are checked against these existing canonical
values. Computed digests do not replace approved values. The archive digest and
Artifact ID are read back from canonical provenance; no archive is reissued.

The separately recorded Platform Runtime Source
`538a208c025fcc5a7d6f9914d3c428b9ef702dbe` and Platform authority merge
`6deba7e8fe4b85ae43b66b7437b46db94ad7c814` are synchronized to the final
Human-provided Platform authorities. This does not change Platform source or
substitute the Runtime Source for Contract Artifact Source.

The verifier updates only the two fixed Platform runtime/authority values.
Validation and authorization logic, Contract pins and all digest checks remain
unchanged. Historical alpha.39/alpha.40 fixtures remain rejection evidence.

## Approved runtime target

Human approved the exact merged Phase5 source from PR #126, with Browser and
Security Production Acceptance PASS. This sync starts from that protected main
and changes only authority metadata, provenance constants, focused tests and
this document. It does not incorporate additional application changes.
Unapproved Runtime delta: NONE.

## Verification and rollout boundary

Focused tests cover acceptance of this authority and rejection of old sources,
old/mixed pins, invalid IDs/digests, untrusted checks and reviewed-tree mismatch.
Run the repository's existing Required Checks and fresh fixed-head self-review.
Their ordinary CI tests/build do not dispatch the Production artifact workflow.
After Squash Merge, invoke the canonical authorization function against live
GitHub readback and validate provenance on the exact Runtime Source, without
workflow dispatch or Production Build.

Authority Sync Runtime Application delta: NONE. Dependencies: NONE. Migration:
NONE. ENV: NONE. Worker: NONE. No Platform changes, new-server operations, service
restarts or activation are part of this sync. OLD Test Runtime remains at the
approved application source. Human Browser Acceptance is already PASS and is not
rerun. Rollback for this change is a reviewed authority-metadata/verifier revert.

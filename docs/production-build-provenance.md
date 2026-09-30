# Production release authority — alpha.41

Authority/provenance synchronization only. Human approved exact Storefront Runtime
Source `db02898cecf6b5d1646401c56579f592be3c4f4e` (merged PR #122), with OLD Test
Technical and Human Browser Acceptance PASS. Production Build dispatch, new-server
operations and Production Activation are not authorized by this change.
`activation_authorized` remains false.

## Separate runtime and workflow sources

The approved Runtime Source stays `db02898cecf6b5d1646401c56579f592be3c4f4e`.
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
`e4361ece51fc1249a5cfb2c64cf56d3aa4bb0c29` and Platform authority merge
`d823c2f80c1500990289b06da8e5504d7b48c2e5` are retained from their prior independent
approval. This Storefront-only sync does not approve, inspect or deploy a new
Platform Runtime Source, and never substitutes Contract Artifact Source for it.

The verifier changes only three fixed provenance values: the canonical directory,
contract version and independent OpenAPI version. Its validation and authorization
logic remain unchanged, including exact pins, immutable manifest, source identity,
unique Artifact ID/archive declarations, digests and Client/Testkit alignment.
Historical alpha.39/alpha.40 fixtures remain as rejection evidence.

## Approved runtime delta

From prior approved source `b85afec9aba0e72732366e8e12701cef39a06e06`, the complete
history is #118 (authority only), #119 (shipping-only prizes and alpha.41), #120
(Save Card/3DS entry), #121 (purchase continuation processing), and #122 (Phase1/
Phase2 design, prize guidance, narrow-screen login and the disclosed fast-uri/
undici development dependency audit fixes). There are no other intervening
commits. Human explicitly approved #122 merge/OLD Test activation and now names
that exact merged source with Technical and Browser Acceptance PASS.
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

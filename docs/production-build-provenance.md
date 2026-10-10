# Production release authority — alpha.43

PRIZERATE-PRODUCTION-20261006 is a Strict Change with Application Runtime Activation `none`.
Human approves exact Storefront Runtime Source
`0d81ef59f6867fe806c0efcb0b2c77ea1d05ad7b` (merged PR #148), with OLD Test
Technical, Human Browser Acceptance and target-specific Security PASS.
`activation_authorized` remains false. Production/NEW connections, Snapshot,
Migration, DB writes, routing/ENV changes and Runtime Activation are prohibited.
The release-specific Human decision permits accepted PR #148 validation and
acceptance evidence reuse, then one fresh Storefront artifact, stopping at
`PRIZERATE_PRODUCTION_ARTIFACT_READY`. Platform artifact generation is excluded.
It is not Production GO and expires with this release or a changed release scope.

## Separate runtime and workflow sources

The approved Runtime Source stays `0d81ef59f6867fe806c0efcb0b2c77ea1d05ad7b`.
This authority PR's merge SHA is workflow/metadata authority only; it must never
replace the approved Runtime Source. The canonical `production-artifact.yml`
checks out approval code from protected current main and application code from
the exact approved source. Source authorization and artifact verification are
unchanged. Both the Source PR and current workflow authority require successful
checks. Empty squash checks are accepted only through the merged internal PR,
identical reviewed/merge trees and successful reviewed-head checks. Failed
current checks never fall back to another commit.

## Exact Contract authority

The existing immutable `vendor/oripa/CONTRACT-20261005/PROVENANCE.md` and manifest
are the canonical alpha.43 readback. Their bytes and all package pins are unchanged.

- Client/Testkit: `2.0.0-alpha.43`.
- Artifact ID: `11349442812`; canonical workflow: `37319224331`.
- Manifest: `vendor/oripa/CONTRACT-20261005/artifact-manifest.json`.
- Manifest SHA-256: `1951edf44ef275e3c9bf85ac0ce1417a27bc64e982a607d0a72e49186eb09e74`.
- Client SHA-256: `9f14026a53d24413d860975d5c012988a5381771600b81e8309e5119a10792b0`.
- Testkit SHA-256: `d5bb5b0d785437e0f400b369ff97663a6c69d4a329c1b82710017087a92af9fb`.
- Public OpenAPI: `2.0.0-alpha.39` (independent version).
- Public OpenAPI SHA-256: `37cdeb7a214d42f0f69458d578a81c5c7869132e2a6cbd02ca8d150f1abf6faa`.
- Outer archive SHA-256: `53fb939978eabbf9b636369b15c81369d18305890891715f7bbd864e9b197d14`.
- Contract Artifact Source: `0ce41ab473fd5a4fb44773041ae097ffb40b14ce`.

Fresh GitHub exact-ID download agrees with all approved digests and the vendored
artifact bytes. No Contract rebuild or republication is allowed. Computed
digests do not replace approved values.

The provenance parser follows the existing alpha.43 document's separate
Artifact ID, canonical workflow URL and GitHub outer SHA256 lines, retaining
single-entry and exact-value checks. The published document itself is unchanged.

Platform Runtime Source is separately fixed at
`4b7d00e8e31223136cd0b70134916d091dfea6cb` (Security PR #543).
Platform Production Authority is
`48639e9cdc44e43534e45dbbb1b6eeb1bfc7d591` (Authority PR #545).
Neither substitutes for Contract Artifact Source or Storefront Runtime Source.

## Exact build and Security toolchains

The alpha.43 authority change synchronized the three Next.js assertions from
`16.3.3` to `16.3.6`. Normal artifact pnpm remains `10.12.1`, including
the manifest version, frozen install, build, prune and package verification.

Human additionally approves replacing the stale raw High-level audit command
with the unchanged `scripts/ci/security-audit-policy.mjs`. As in canonical CI,
an isolated audit directory uses exact pnpm `11.25.0`. Production findings must
be zero across every severity; unapproved High/Critical fail. The existing
dev-only braces 3.0.3 exception applies only to its exact approved fingerprint.
No exception, Moderate baseline, suppression or threshold is added or changed.
After a successful audit, corepack restores pnpm `10.12.1` and an exact version
assertion must pass before lint, tests, build, prune or packaging proceeds.
An audit or restoration failure prevents downstream steps.

## Verification and rollout boundary

Focused tests retain source/check/tree, immutable artifact and digest guards,
reject historical alpha.39/alpha.40/alpha.41 fixtures, and exercise audit
isolation, audit failure and incorrect-toolchain-restoration failure.
Ruleset Required Checks and fresh exact-head self-review are mandatory. Under
the release-only waiver, pending non-Required checks do not block; completed
Security/Source/Artifact/Contract/Migration or SEV-0/SEV-1 failures still HOLD.
Existing accepted Runtime Source full validation is reused without local reruns.
Application, dependency, Contract, migration and ENV source deltas are NONE.

Human separately authorizes one fresh canonical ARM64 artifact dispatch after
authority merge and current authorization checks, followed by exact-ID download,
digest/provenance/package verification and native runtime smoke. The canonical
public app name is read back from the previous verified Production artifact,
not inferred from test fixtures. CI verification artifacts are not release artifacts.
PR #144 and PR #137 remain OPEN/UNMERGED through preparation and final release closure.
No other PR is incorporated. Human Browser Acceptance is already PASS.
OLD Test deployment and acceptance are reused without another activation or
browser checkpoint. Same-head CI reruns are prohibited. Platform Runtime,
Production Authority, Contract alpha.43, database, workers, deferred Scheduler
and ENV remain unchanged; no migration or Snapshot is required.
Rollback of this authority change requires a reviewed authority-only revert;
existing runtimes and rollback artifacts remain untouched.

## Next.js security source update — 2026-10-10

`STOREFRONT-NEXTSEC-20261010` pins Next.js and eslint-config-next to `16.3.8`
and synchronizes all three workflow assertions: installed package, packaging
version and re-downloaded artifact manifest. Node remains `22.22.3`, normal
pnpm remains `10.12.1`, and isolated audit pnpm remains `11.25.0`. The security
policy and its exact dev-only exception are unchanged.

This is source/test/CI preparation only. It does not authorize a new Runtime
Source, reuse historical acceptance for a new candidate, dispatch the workflow,
publish an artifact or activate a runtime. Existing release SHA authorities,
checksums, Build ID, Contract provenance, ARM64 verification and Human release
checks remain intact; a future candidate needs its own exact source authority.

The S3 Production Candidate task must separately integrate and verify the
CloudFront build inputs `NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL` and
`NEXT_PUBLIC_STATIC_ASSET_BASE_URL`. They are not added to this workflow here.
PR #154 is excluded from this change and requires separate regression after
the dependency fix is merged through Human review.

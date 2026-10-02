# Storefront Production Readiness Shadow Classifier

PRG-20261002 / Strict Change / R4 / Application Runtime Activation none.
Observation only; no Production flow, CI skip, Activation or Human GO authority.

Formal authority: Production Readiness Gate v1.1 (2026-10-01), SHA-256
`e7e3a6fedfa232d06e00e36f14e79399d03fc6f5dfa8550f801b60d57a2e87a9`.

## Offline usage

```bash
node scripts/readiness/classifier.mjs \
  . <full-base-sha> <full-head-sha> /tmp/readiness-shadow.json [handoff.json]
pnpm exec vitest run src/test/readiness-classifier.test.mjs
```

The git reader requires a clean exact-head checkout and complete ancestor diff.
It reads both source trees without checking out files or contacting Production.
Output creation is exclusive. Invalid input or classifier failure records an
observation fallback, never FAST LANE. Existing Required Checks remain unchanged;
the separate workflow only produces a downloadable Shadow record. Unit tests
also run through the existing `pnpm test` integration gate.

Optional handoff v1.0 fields: `repository`, `base_sha`, `head_sha`, `tree_sha`,
`platform_impact=NONE`, `evidence_reference`, `confirmed_by_role=human_operator`,
`record_digest`, and optionally `machine_policy`. All exact identities must
match the git input. Digest canonicalization uses sorted keys, compact UTF-8
JSON, one trailing LF and SHA-256 excluding `record_digest`. The Human-assisted
transport is trusted; a digest does not independently authenticate its author.
No handoff means Platform impact UNKNOWN and Full fallback.

## Machine Policy and classification

`minor-policy.v1.json` is **PROPOSED_SHADOW_ONLY**. `approved_at` and
`approved_by_role` are intentionally null. Numeric bounds and allowlists need
Human approval; the implementation does not invent that approval. Without an
approved supplied policy the record preserves its analysis but falls back to
Normal. Tests label their supplied approval data as synthetic fixtures.

Path eligibility, TypeScript AST comparison, scoped CSS declaration comparison,
asset decoding and transitive import impacts must all pass. The existing pinned
TypeScript and Next image tooling are reused without dependency/lockfile changes.
Only literal className, bounded literal style values, noncritical JSX display
text, scoped CSS and explicit decorative raster paths are recognized. Handler,
state, conditional, API, payload, routing, Contract, dependency, configuration,
CI and policy changes cannot enter Minor. Changed tree shape is rejected.

Class changes are bounded spacing utilities; dynamic class/style expressions
are rejected. Selector-referenced classes, visibility, opacity, clipping,
overflow, overlay positioning, focus/disabled state selectors and global styles
fall back. Raster inputs are decoded, single-frame PNG/JPEG/WebP with identical
format/dimensions, fixed size/growth/dimension limits and unchanged source path.
Business assets and SVG are excluded. This initial policy is deliberately
enumerated; unsupported values remain UNCLASSIFIED until policy review.

`impact-map.v1.json` describes all 19 requested domains, paths/symbols, shared
dependencies, routes, states and browser scope. Imports are resolved in both
trees and transitively expanded; unresolved local or dynamic imports fall back.
Shared layout expands routes. The acceptance plan records affected components,
routes, states and mobile/desktop classes with HUMAN_BROWSER_ACCEPTANCE_PENDING.
No browser is run and no Human acceptance is manufactured.

## Existing authority reuse

`adapters.mjs` reuses the existing `production-provenance.mjs` check-run and
source validators with offline response maps; absent responses never cause a
network request. Contract validation requires explicit approved authority.
The current Production-specific validator retains its alpha.41 authority;
latest main's immutable alpha.42 remains validated by the existing
`verify-vendored-artifacts.mjs`. The classifier changes neither authority nor
pins. The Platform consumer handles R1–R6, Step Matrix, Snapshot/Continuity,
Human GO schema, Artifact failure categories and RB1–RB6 independently; no new
cross-repository runtime dependency is introduced.

## Human review

Review proposed numeric CSS/asset constraints and class coverage before marking
the Machine Policy approved. Actual Production handoff, Shadow samples,
Browser Acceptance, Production GO, merge and Phase 2/Promotion are not performed.
Source rollback is a reviewed revert PR, with no runtime activation required.

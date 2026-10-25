# SITE-SHIPPINGMIN-20261023 — formal alpha.46 integration handoff

R3 / Strict Change. PR #178 remains **Draft**. Ready, Source Merge, auto-merge,
Preview Activation and Production Activation are not authorized for this task.
Application Runtime Activation is deferred; Runtime / OLD Test / Production /
Platform Source changes: **0**. The historical publication HOLD below is resolved
by the immutable published alpha.46 artifact, not by promoting a candidate.

## Storefront and Platform authority

Stage A PR #180 was explicitly approved and Squash Merged by Human instruction.
Reviewed HEAD `78c48077a537eec367cf8501b7f8db5230f7d5d1`, reviewed Tree
`3d2baf03d1b59aaa52fb3a7de81e3a148ca2934c`.
Actual Squash Merge `99ed66db95bf6fdcd9a22b60d259bbb33e564a3a`, Merge Tree
`3d2baf03d1b59aaa52fb3a7de81e3a148ca2934c`; actor
`ideal-sol-oripa-codex[bot]`. Reviewed/Merge trees equal, content diff 0 and
protected main matched the actual Merge SHA before starting Stage B.
Its five Required Checks and fresh canonical machine-readable self-review passed
(SEV-0 = 0, SEV-1 = 0). Stage B non-destructively merges that main into the
existing PR #178 branch, preserving the earlier UI and tests. No force push.
Next.js 16.4.2, React 19.2.8, sharp 0.35.5, scoped zod 4.6.6 and undici 8.12.2
resolutions remain intact. PR #179 Source, branch, worktree and PR are untouched.

Formal Platform Ledger:
`3592fcdc8e43467c3dd67d2677ec52b7d328eb77` (26 immutable entries,
latest_immutable alpha.46, candidate null).
Published Source `1d2b0d8ff8193d55173f5bf6978a41f3dfebf7ac`.
[Canonical artifact](https://github.com/ideal-sol/oripa/actions/runs/40162277779/artifacts/12586773046),
run 40162277779, attempt 1, artifact ID 12586773046.

- Outer ZIP SHA-256: `fb4bc9f64b0810e3efae8aaa85252b8fa86ec8c5fd03fb361459c5a627bca275`.
- Manifest: `a55f578a94af700e68f0cd0d8eed0e18fb3867ec3be5e0ac0c8639a173cf2b26`.
- Client: `08bbfe84dd8e57fb69ba4578cbd1d63e711a0a579996821ecbec6bd5a6133a3f`.
- Testkit: `f4e324b859d1d96d66e78c9c1adf16616f132e4b114b10a2af4e9e5fe5a5de83`.
- Public OpenAPI: `81ee96478ee3d80539817b54321f9f6d181c2a78a3dae2062527dd81049dcec4`.
- SHA256SUMS: `0377250f61bb15420fb58e0ab4b572289ded5a69407e48d43195fb4128c23372`.

The official ZIP bytes and all five inner files were verified. Client/Testkit
package metadata, runtime header version and dependency compatibility are checked
by artifact verification and Contract tests. New immutable vendor directory:
`vendor/oripa/SHIPPINGMIN-20261023`. Exact file pins are Client and Testkit
2.0.0-alpha.46, including the Client override. Public OpenAPI is alpha.42 / 84
operations; Site Schema remains the same referenced alpha.23 in MIG-063B.
No older vendor file is overwritten or deleted. The alpha.46 generated availability
reason enum adds three values; the existing exhaustive label maps reuse the
current generic eligibility message/button label for these values, with three
regression cases. This is type compatibility only, with no new eligibility logic
or layout. Production authority and its
workflow stay alpha.45; upgraded development Source is deliberately rejected by
that unchanged authority until a separate future approval. Its regression test
now asserts that rejection instead of claiming new Source is Production-approved.

## Typed shipping integration and unchanged UI

`ShippingPolicySnapshot` uses generated `ShippingPolicy`; the minimum snapshot
picks generated `ShippingMinimumPointsProblem` fields. The required
`ShippingPolicyAccess` is provided by the canonical Browser Client:
`getShippingPolicy(signal)` and `isShippingMinimumPointsProblemError(error)`.
Only named safe decimal/revision fields leave the error adapter; detail/title
are never rendered. No direct fetch, HTTP client/proxy, any or forced cast.
GET preserves the Session/SMS contract and caller AbortSignal. The endpoint
no-store policy is verified against the immutable OpenAPI; mock reads do not
prove deployed response cache headers. Runtime verification remains deferred.

The existing `/mypage/prizes` selection, confirmation dialog, buttons, warning
CSS and Coin terminology stay intact. No CSS, page, modal or selection-rule
change. Backend-allowed shipping candidates alone contribute to BigInt totals;
invalid snapshot/policy values fail closed. The Server effective requirement is
used without Number conversion; zero-only selections remain blocked.

Policy loading/reload, canceled/obsolete responses, a monotonic accepted/rejected
revision floor, typed 409 refresh, safe shortage presentation and preserved
address/selection are verified. No 409 auto-resend. A network-uncertain mutation
keeps its key for an identical payload; changed address/prize payloads get a new
key. SMS/CSRF, address edit/delete/reconciliation and Coin exchange retain their
existing authority and flow. Official Testkit SHIPPING_POLICY_FIXTURES and
SHIPPING_MINIMUM_PROBLEM_FIXTURE replace provisional contract assumptions.

## Verification evidence and remaining acceptance

Exact final HEAD/Tree, changed paths, test counts, CI run URLs, Security Audit
counts and fixed-head machine-readable self-review are recorded in the updated
[PR #178](https://github.com/ideal-sol/luxe-pack-storefront/pull/178) after the
last commit; they are the final validation authority. Required Checks remain
policy-gate, quality-gate, security-gate, integration-gate and ci-gate.
The completion status is SITE_SHIPPINGMIN_ALPHA46_INTEGRATED_DRAFT_READY_MERGE_HOLD
only when all five checks and fresh review pass at that final HEAD. A failure
remains SITE_SHIPPINGMIN_ALPHA46_INTEGRATION_HOLD; no gate or exception is relaxed.

UI/Contract mocks are Source evidence. Deployed Preview Runtime Acceptance and
login-required Human Browser Acceptance are **NOT RUN**, awaiting separate
Activation approval. Human acceptance should cover shortage/exact/above/zero,
reopening with added prizes, live setting changes, network retries, SMS/address
behavior, keyboard alert announcement and mobile overflow. Draft-only Source
completion does not authorize PR #178 Ready/Merge or Runtime Activation.

## Historical HOLD record — superseded authority and provisional implementation

The original handoff is retained below as history. Its alpha.46-pending and
Security-HOLD statements describe the earlier saved HEAD, not current authority.

---

# SITE-SHIPPINGMIN-20261023 — shipping minimum handoff

Status: **SITE_SHIPPINGMIN_CONTRACT_HOLD**. R3 / Strict Change. Keep the PR Draft;
Human GO is required before Ready, Merge or auto-merge. Application Runtime
Activation is deferred. OLD Test / Production / ENV / server / DB / AWS /
Platform Source changes: **0**.

## Source and artifact authority

Live Source recheck on 2026-10-23 matched the supplied bases:

- Storefront main: `7ca779fa7e778908baf6217f330b317ec616e260`.
- Platform main: `69dde1868f20b6fbacc06849c8ff0535b74b145e`.
- [Platform shipping handoff](https://github.com/ideal-sol/oripa/blob/69dde1868f20b6fbacc06849c8ff0535b74b145e/docs/implementation/SHIPPINGMIN_HANDOFF_2026-10-23.md).
- [Formal release ledger](https://github.com/ideal-sol/oripa/blob/69dde1868f20b6fbacc06849c8ff0535b74b145e/manifests/storefront-contract-releases.json):
  latest immutable alpha.45; alpha.46 candidate **pending** (84 operations,
  public alpha.42, bundle SHA-256
  `81ee96478ee3d80539817b54321f9f6d181c2a78a3dae2062527dd81049dcec4`).
  This candidate hash is Source evidence, not package publication evidence.
- Retained alpha.45 manifest SHA-256:
  `0fd03ceb42cf316fc01de0c9757ee20be3bc1242b25cd52bc20870c50c2ce3a5`;
  Client `4a78f26395807fd0eff231249c9f2547d416de4a439309605fee9cd903433c4e`;
  Testkit `8e6577375c864a0681aa475ee39c6c7a0958bc09c754a92cd1252f543b9b2a7a`.

No package/lockfile/vendor Manifest/checksum change or unpublished tgz adoption.
No direct HTTP call, invented API proxy, `any` or forced Client cast.

## Saved implementation

`/mypage/prizes`, checkbox selection, action tray, SMS gate, address registration /
selection / editing / deletion and Coin exchange retain their existing flows.
The existing confirmation dialog and buttons are reused; no CSS, page or modal
is added. The shipping warning precedes the confirmation button and reuses
`fulfillment-dialog__error` with `role="alert"`. Text consistently uses コイン.

Only Backend-allowed shipping candidates contribute to the preview. Each safe,
nonnegative integer snapshot becomes BigInt before addition; up to 100 maximum
values total exactly `900719925474099100`. Policy decimal strings remain BigInt.
Invalid/missing values never become zero. Use the Server-provided effective
requirement, including the positive requirement for an all-zero selection.

Loading, safe failure plus manual reload, disabled confirmation, cancellation,
and fresh selection calculation on reopen are implemented. A validated minimum
rejection retains selected prizes and address, displays safe Server values and
reloads policy without resubmitting. Policies older than the rejection revision
remain blocked. Aborted/obsolete/closed-dialog policy responses are ignored.
Uncertain mutation retries retain the same key for the same address/prize payload;
a changed payload uses a new key. Existing Browser CSRF remains Client-owned.

## Contract hold and typed connection design

`ShippingPolicyAccess` is an explicit local UI port with `load(signal)` and
`minimumRejection(error)`. Its decimal/revision snapshots mirror the inspected
pending Source but do not claim published generated types. The real alpha.45
factory does **not** provide this port: condition loading fails safely, offers
reload, and shipping confirmation stays disabled. Coin exchange does not load
policy. This Draft must not be deployed or treated as a finished shipping flow.

UI tests inject a local port. They do **not** establish alpha.46 API integration,
the official 409 type guard, SMS enforcement on the new endpoint, or Runtime
acceptance. Existing alpha.45 Contract tests continue to exercise the canonical
Client and explicitly verify that policy capability is absent.

After separate formal publication:

1. Recheck latest Source and canonical immutable Manifest/publication metadata.
   Retrieve the named official artifact via its approved publication route;
   verify source commit, Manifest hash, SHA256SUMS, Client/Testkit files and
   public bundle compatibility. Do not promote a candidate or arbitrary tgz.
2. Adopt exact alpha.46 Client/Testkit pins and lockfile together, preserving
   immutable alpha.45 history. Use the generated ShippingPolicy type instead
   of the temporary snapshot interface.
3. In `src/lib/platform/prize-client.ts`, supply the UI port from the real
   canonical Client: `load(signal)` returns `(await client.getShippingPolicy(signal)).data`;
   `minimumRejection(error)` returns its safe fields only after
   `isShippingMinimumPointsProblemError(error)` succeeds, otherwise null.
   Do not infer an absent API through a cast or use a direct request fallback.
4. Replace local policy/rejection fixtures with official Testkit fixtures where
   applicable. Add real Client Contract tests for policy, decimal preservation,
   typed 409, no-store/session/SMS behavior and changed-policy idempotent replay.
5. Rerun artifact/boundary/policy/quality/Contract/UI/build and all five Required
   Checks on the final HEAD, then repeat fixed-head machine-readable self-review.
   Complete affected Preview acceptance after separately authorized activation.

## Verification and remaining acceptance

Focused tests cover threshold/boundary/zero/mixed snapshots, shipping-only and
denied candidates, loading/failure/reload, invalid policy/snapshot values,
Server409 policy refresh/revision protection/address retention, identical-key
network retry, stale/closed responses, maximum integer/100 selections,
reopening after additional selection, accessibility/disabled controls and the
existing SMS/address/success/Coin regressions. Existing assertions are retained;
the prior shipping-only success fixture now has positive value to satisfy the
new positive-total rule.

The first local focused run had 79 PASS / 6 FAIL under shared-host load, including
five 5-second test timeouts and one inventory-loading wait failure. No timeout,
assertion, Security Gate or Required Check is relaxed. Subsequent actual outcomes,
local browser fixture checks, final HEAD/Tree, changed paths, CI links and fresh
machine-readable self-review are recorded in the Draft PR; that final-head
record is authoritative over this initial attempt.

The first hosted run additionally identified the exact source inventory missing
the four new files and a new test expecting only two SMS reads despite the
initial Session read plus two dialog opens. Register those four files in the
existing inventory and assert all three SMS reads. No classifier rule, assertion
strength, workflow or Required Check is relaxed. Its Security Gate also found
production dependency advisories with package/lockfile unchanged; retain that
separate Security HOLD and record the final audit details in the PR.

Formal alpha.46 integration: **NOT RUN / blocked by publication**. Login-required
Human Browser Acceptance and deployed Preview Runtime Acceptance: **NOT RUN**.
Human should verify the existing `/mypage/prizes` flow after formal adoption:
insufficient / exact / above / zero-only, additional selections, settings change
during confirmation, retries, address/SMS behavior, keyboard alert announcement
and mobile overflow. Do not claim mock fixtures as authenticated acceptance.

The final PR must remain Draft even if all available checks pass. Required check
names, verified from the active main ruleset: `policy-gate`, `quality-gate`,
`security-gate`, `integration-gate`, `ci-gate`.

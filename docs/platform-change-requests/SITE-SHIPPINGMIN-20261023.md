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

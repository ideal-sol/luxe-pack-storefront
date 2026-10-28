# SF-PAYUI alpha.47 integration handoff — 2026-10-28

SF-PAYUI-ALPHA47-INTEGRATE-20261028 continues PR #192 and Issue #190 on
`feat/SF-PAYUI-20261027`. R3 / Strict Change / Application Runtime Activation:
`deferred`. The latest Human instruction authorizes canonical Source Squash
Merge only after every applicable acceptance gate. It supersedes the previous
alpha.46 adoption freeze and Draft-only authorization. It does not waive SDK
acceptance, authorize a Production Authority change or permit Runtime rollout.

Current disposition: `SF_PAYUI_ALPHA47_INTEGRATION_OR_MERGE_HOLD`. Keep Draft.
The final immutable Head/Tree, CI results and fresh HOLD self-review are attached
to [PR #192](https://github.com/ideal-sol/luxe-pack-storefront/pull/192).

## Formal artifact authority

- Integrated Platform Source: `c15eea6887c9fd16f3096cfb27ed78b599262c7e`;
  Source tree: `fc387234edb75b019dd3df34ca723f8c45c9ec46`.
- Formal publication [run 40624953499](https://github.com/ideal-sol/oripa/actions/runs/40624953499),
  attempt 1; authorize/publish/readback successful. Artifact `12788389958`,
  `oripa-storefront-contract-2.0.0-alpha.47`, fetched by exact Artifact ID.
- Outer ZIP SHA-256:
  `e0e330e9f58750a78ea19bda73f9386af5e464b6400756f40cd62cb72830dd98`.
- Ledger [PR #627](https://github.com/ideal-sol/oripa/pull/627), Squash
  `cc66862883624e8257e6abf83bf1f9b46fb7cce5`, tree
  `098604d7b88052256a908fe9133afd3aceb465a8`; 27 immutable entries,
  latest alpha.47, candidate null. Publication, live Ledger and merge were
  independently read back through the canonical GitHub App. Platform READ-ONLY.
- Client/Testkit `2.0.0-alpha.47`, Public `2.0.0-alpha.43` (90 operations),
  Site Schema retained `2.0.0-alpha.23`. Manifest SHA-256:
  `e1d576f61611bfeea4011122736f443cbfd4320e198cb01a73aa5d714a947c5d`.
- Exact formal TGZs, OpenAPI, manifest and SHA256SUMS are retained under
  `vendor/oripa/PAY234-ALPHA47-20261028/`; individual digests and provenance are
  in its `PROVENANCE.md`. No repack, independent Draft artifact or floating pin.
  Every prior vendor remains byte-identical, including alpha.46.
- Supplied payment specification v2.2 was checksum verified:
  `70d47974a5287b9916a0c8467bd8d1352a71eaf074c7d3a21d37f62bc8d5b58d`.

## Source integration

Protected main `635a891e920ad2b21b7111423c973dc38c889971` was incorporated by
normal Git Merge into the existing isolated branch. No rebase or force push.
GTM Workflow #189, Source Authority #191 and the PR186 approved Runtime Source
remain intact. `docs/production-approved-source.json`, the Production workflow,
GTM build verifier and Production provenance verifier match that protected main.
The current candidate package being alpha.47 does not change alpha.46 Production
authority: the negative provenance test explicitly rejects this candidate under
the current approved authority, while its retained alpha.46 fixture still passes.

`createCsrfManagedStorefrontPaymentClient` supplies all six Gateway methods:
list/start/get/event/UnivaPay report/Paidy authorization. Production context
resolves the Gateway from the canonical Client by default. No custom HTTP or
provider-secret boundary was added. UI schemas derive from formal generated
types; unknown actions remain runtime-validated. API order/labels/availability,
flow, saved-card policy and product limits control the UI. There is no fixed
four-method fallback. Unavailable Client, failed/empty listing and unsupported
methods fail closed. Explicit fincode selection and its card registration,
saved-card 3DS, SMS and purchase-correlation behavior remain.

Techcoin native POST retains the six server fields in exact order:
`clientip, payment_code, cookie, price, sendid, email`. Only the approved HTTPS
destination is allowed. Paidy authorized callbacks use the formal authorization
endpoint once with a separate idempotency key; the browser does not Retrieve or
Capture. Callback/advisory/return results never grant balance or display a
financial success independently of canonical GET/Webhook.

## Blocking SDK and acceptance findings

1. **UnivaPay safe normal Browser Driver is NOT complete.** The existing
   `mountInline` guard remains fail-closed. Do not merge or replace it with a
   guessed validity/result decoder. The official
   [JavaScript integration guide](https://docs.univapay.com/docs/guide/implement/iframe/js/)
   and live `https://widget.univapay.com/client/checkout.js` were read. Downloaded
   Script SHA-256:
   `bd8468535148bfa270d955e16e4c4b12d1e139eb6e376a6146847832eceae117`.
   A Chromium fixture executed the downloaded Script with synthetic inputs and
   blocked external Provider requests. Its public create/update/submit/validate
   exports exist. In the inspected Connector implementation, `validate()` sends
   `validate-form`, but its message handler has no `FORM_VALIDATED` case; the
   short isolated validation probe remains pending, not positively valid.
   Checkout has no public close/dispose method. Calling its observed internal
   close with a nested owned container throws DOM `NotFoundError`, because it
   removes that container from document.body. This is a synthetic compatibility
   finding, not a real merchant/payment test. A supported positive validation
   and complete owned-frame/listener/3DS disposal contract, or a separately
   verified safe implementation, is needed before enabling the normal Driver.
   U8/U10/U12 and raw charge-ID normalization remain unverified. Never infer a
   charge ID or successful payment from a raw Promise/event.
2. **Paidy lifecycle acceptance remains incomplete.** The downloaded normal
   Checkout Script uses `configure({api_key, closed})` and `launch(payload)`.
   Source suppresses callbacks after abort/disposal and handles duplicate,
   rejected/closed/unknown results, but complete real overlay and SDK listener
   removal on logout/SPA navigation has not been established. A synthetic
   callback test does not prove real overlay disposal or focus behavior.
3. **Affected Source Browser/Preview Runtime Acceptance is incomplete.** An
   isolated loopback Next dev process was attempted with synthetic intercepted
   API/SDK fixtures. Initial route compilation exceeded its 180-second browser
   navigation deadline; no payment-screen Browser PASS is claimed. That
   task-owned process was stopped. No shared Preview deployment was attempted.
   Complete the accepted canonical Browser/Preview gate before Ready/Merge.

The real SDK probe cannot be substituted for a complete payment-screen runtime
acceptance. Required CI PASS and Mock tests likewise cannot waive these gates.
Fresh self-review must retain HOLD while these findings remain. No MERGE
recommendation or success status is authorized by partial Source integration.

## Validation and later activation handoff

The PR records actual local commands separately from formal CI, including any
host-load cancellation or timeout. Formal artifact digest/header checks and
frozen install were executed. Focused contract/Mock coverage exercises the real
Gateway, CSRF/Idempotency, all three provider dispatchers, fincode registration
and 3DS, duplicate callbacks, opaque correlation, unknown/pending results,
disabled methods, old history, Auth/LINE/GTM storage boundaries and Brand guards.
No real key, card, merchant transaction, Provider 3DS, Webhook or real Return
acceptance was run. These remain NOT RUN for authorized OLD Test work.

The supplied two PNGs and all 25 preceding Brand keys/bytes are unchanged.
The candidate has 27 Brand assets and Source manifest version
`sha256-e14476bb46508a7f82edab331cda7fb1b3071bda8dc63b4be693466d7ab92d12`.
The current Production workflow intentionally rejects the 27-asset version.
Later authorized Production preparation must approve a narrow compatible guard,
upload and verify Brand CDN objects, and establish a compatible exact Runtime
Source/contract/manifest authority. This Draft does not make a formal Production
artifact buildable or authorize Dispatch.

For OLD Test integration after Source acceptance: use only the formally
published alpha.47 and reviewed merged Source, preserve GTM configuration and
immutable assets, then obtain the separate runtime authorization. Keep Issue
#190 open for U8/U10/U12, Paidy P1/P2/P3/P5, Techcoin T3/T4/T8, merchant/brand/legal
acceptance and PAY4 Capture retry specification v2.2 §6.4.3(2). The latter remains
a Backend/Human/Provider OPEN decision; no UI recapture or forced re-payment.

No ENV file, DB, Worker, OLD Test, shared Preview, NEW Production, CDN object,
Production Source Authority, Production artifact Dispatch or deployment changed.
Migrations created/applied: 0/0. Rollback is a reviewed Source revert restoring
coherent alpha.46 package/lock pins and prior wiring; retain immutable vendors.
The existing Draft branch/worktree and tracking Issue stay available for the
remaining implementation and acceptance work.

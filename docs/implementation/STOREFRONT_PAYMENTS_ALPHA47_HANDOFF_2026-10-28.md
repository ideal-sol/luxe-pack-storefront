# SF-PAYUI alpha.47 integration handoff — 2026-10-28

SF-PAYUI-ALPHA47-INTEGRATE-20261028 continues PR #192 and Issue #190 on
`feat/SF-PAYUI-20261027`. R3 / Strict Change / Application Runtime Activation:
`deferred`. The latest Human instruction authorizes canonical Source Squash
Merge only after every applicable acceptance gate. It supersedes the previous
alpha.46 adoption freeze and Draft-only authorization. It does not waive SDK
acceptance, authorize a Production Authority change or permit Runtime rollout.

Continuation: SF-PAYUI-192 authorizes resolution of the two SDK findings,
task-owned Source Browser Acceptance and conditional canonical Source Merge.
The immutable Head/Tree, current disposition, CI and fresh self-review are
attached to [PR #192](https://github.com/ideal-sol/luxe-pack-storefront/pull/192).
Shared Preview and OLD Test activation remain outside this authorization.

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

## SDK lifetime and authority

SF-PAYUI-SDK-01 uses the public `create`, instance `open(undefined, target)`,
`update(ownedIframe, serverUpdate, { forceUpdate: true })` and `submit(ownedIframe)`.
Only the iframe returned by that instance and contained by its target is used.
No card fields, raw provider resources or private connector APIs are read.
The [official inline guide](https://docs.univapay.com/docs/guide/implement/iframe/js/)
performs validation inside `submit()`. The browser driver uses that supported
flow; readiness is distinct from validity. It does not call the unresponsive
`validate()` or claim that an empty validation-error notification proves validity.
The injected validation adapter remains available for contract fixtures.

UnivaPay Script SHA-256 (re-read, unchanged):
`bd8468535148bfa270d955e16e4c4b12d1e139eb6e376a6146847832eceae117`.
Mount/update are bounded to 15 seconds; submit allows 300 seconds for provider
3DS. Submission is one-shot. A resolved, rejected or timed-out raw Promise is
unknown; correlation remains locked and the page checks canonical Payment
status. There is no raw charge-ID decoder or client financial-success decision.
Provider validation and 3DS stay inside the provider's own UI. The
[official callback guide](https://docs.univapay.com/docs/guide/implement/widget/install/)
also distinguishes 3DS completion from payment success.

SF-PAYUI-SDK-02 retains the normal
[Paidy Checkout contract](https://paidy.com/docs/en/paidycheckout.html):
`configure({ api_key, closed })` and `launch(serverPayload)`. Script v3.1.5 SHA-256:
`5d15d443240494ff621dd09e36a7678b20f5f9a594c7623410cce5dbfb40ceb0`.
The adapter accepts only the first callback while its original lifetime is
active. Authorized `pay_` IDs go through canonical server confirmation once;
duplicate, canceled and later callbacks cannot act as another member.

Neither SDK has a documented disposer. The approved alternative is **document
termination**, shared by these two SDKs only. Once either is loaded, method
switches and site links perform full-page navigation; the optional
`payment_method` query selects only an available API-listed method and carries
no payment or member data. Unmount, session loss and history navigation retire
the document. A restored back/forward-cache document is reloaded before reuse.
There is at most one provider SDK lifetime per document. No Provider-owned DOM
is deleted and no private `close`, connector, listener registry or frame object
is used. Full-page replacement ends the SDK's global callbacks, hidden overlay,
input frames and 3DS frames together.

Logout revokes callbacks **before** the existing canonical logout request and
defers page termination until that request settles (including failure). Unmount
during logout cannot abort the request by prematurely unloading the page.
Other authentication behavior and all fincode paths retain their existing flow.

The earlier internal-close/validation probe remains historical evidence of why
private disposal and guessed positive validity were rejected. It is not used by
the browser driver. Source Browser evidence must cover these document boundaries
using the downloaded SDKs with synthetic API/provider frames. This is not real
merchant or payment acceptance. Final acceptance and exact-head gates are in
the PR; retain Draft HOLD unless all required conditions pass.

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

# SF-PAYUI-20261027 — Storefront payment UI Source handoff

Risk R3 / Lane Strict Change / Application Runtime Activation `deferred`.
Issue #190 tracks the long-running formal Client and provider/brand acceptance.
Stop at Draft. Ready, merge, auto-merge, Production Artifact publication and all
OLD Test / Preview / NEW Production activation remain prohibited.

## Source and input authority

Dedicated branch `feat/SF-PAYUI-20261027` starts from the latest protected main
observed at task start: `ab52ea83c5a812be0c215b958e64cd01a84720ea`.
The occupied primary checkout and other worktrees are untouched. The Draft PR
records final local/remote HEAD, tree, exact changed paths, check results and
machine-readable self-review; those values cannot be embedded in their own tree.
The task worktree is retained after Draft delivery.

Supplied specification v2.2, full implementation instructions and design were
read. The original specification, sample HTML, embedded sample card data and
provider materials are not copied into this public repository.

| Input | Verified SHA-256 |
| --- | --- |
| Specification v2.2 | `70d47974a5287b9916a0c8467bd8d1352a71eaf074c7d3a21d37f62bc8d5b58d` |
| Design HTML | `cbaed6b1c14282599a0b5f576b114c9f0e8fd78dffcf6bce8112fbc3cc6fbb5e` |
| NetRideCash PNG | `e9726a4fcd722a5f2c7cc6c6f6a8da9ff317cd0ba2163b856ce4890a8e518e4e` |
| Paidy PNG | `2cd8cacd72b05f09ea9329e23dc4775b34d0bf9bab5621fd88ceae181c49f203` |

Platform is READ-ONLY. Live PR metadata and source were compared:

| Authority | Reference |
| --- | --- |
| PAY1 merge, PR #620 | `85c2b72c3595b68dda60388ff584cefff775c181` |
| PAY2 Draft #622 | `dc269f0361424edcd87162f39335e41e82bd2966` |
| PAY4 Draft #623 | `6fff61c788e3810995d5214e4b0ace56e350c8bc` |
| PAY3 Draft #624 | `4352ae7be5cf84a4e5517d0750fed8fe80da24fe` |

These are independent candidates. Their alpha.47 numbers do not identify one
integrated artifact. Public schema optional `inline_form`, `phoneNumber`, buyer
name and buyer-history fields and canonical Client operation signatures were
checked against those heads, including PAY4 `paidy-schemas.yaml`.

## Implementation and formal Client boundary

`payment-ui-gateway.ts` is the bounded provisional UI contract. It does no I/O.
`PaymentClientProvider.uiGateway` is the one explicit integration injection point.
There is no raw API fetch, proxy, transport.request, candidate tarball copy,
repacking or claim that missing alpha.46 methods exist. Package/lockfile,
vendor files and formal contract manifests remain unchanged: Client/Testkit
alpha.46, Site Schema alpha.23, Node 22.22.3, pnpm 10.12.1, Next 16.4.2.

When listing is present, only its ordered data/labels/availability are used;
empty/error responses never restore local methods. Unknown methods retain API
labels without invented presentation; unknown flows/actions cannot submit.
Listing is correlated with member and product and supports explicit reload.
Only the pinned alpha.46 adapter lacking `listPaymentMethods` uses the previous
four fincode choices. Its factory explicitly rejects an unexpected newer Client
until integration is implemented. Remove this compatibility path in the later
approved formal Client adoption and wire all six Gateway methods through the
canonical CSRF/idempotency-managed Client. Do not hand-code endpoints.

Provider UI starts exactly on purchase click and submits only product ID and
method. It reuses server prices/metadata/payload. A synchronous submission claim
and opaque per-member session correlation prevent replacement starts after
unknown results or reentry. Correlation stores only product/payment IDs and an
idempotency key. Known terminal canonical results or definite provider rejection/
closure release it. Unknown starts stay locked; no automatic new payment is made.
Unresolved correlation requires canonical history/reconciliation before another
purchase; there is deliberately no client-side override to charge again.

NetRideCash validates the exact HTTPS action and six ordered string fields,
then uses a native hidden form POST without rewriting values. UnivaPay checks
one_time options, script and server amount before update(forceUpdate) then
submit. Paidy uses normal-payment `configure({api_key, closed})`/`launch(payload)`;
authorized callbacks require valid `pay_` ID and one Backend confirmation per
attempt. Unknown callbacks use canonical status/Thanks. Neither callback nor URL
grants points. Telemetry is allowlisted and bounded to 350 ms, with no raw provider
result, token, payload, email or phone in events. Purchase never waits indefinitely
for telemetry. New provider returns do not offer fincode unpaid resume.

The legacy fincode card component, saved-card registration/return correlation,
tokenization, 3DS, environment checks, Konbini/bank guides, SMS gate, first-user
offer and server purchase eligibility remain. API saved_cards_enabled=false
disables saved-card UI and listCards/registration/deletion operations. Backend
method_label is preferred in history and successful result. Nonterminal methods
other than existing offline guides use the existing 2 s / 30 s polling policy.
Return display respects canonical success, pending, failure, cancellation and
expiry instead of treating all returns as failure.

## SDK acceptance deliberately pending

Official references checked on 2026-10-27:

- [UnivaPay inline JavaScript](https://docs.univapay.com/docs/guide/implement/iframe/js/)
  documents create/open and iframe update/submit. The public checkout.js was
  inspected read-only. Its current container/lifecycle internals are not treated
  as an accepted stable disposal API.
- [Paidy normal Checkout](https://paidy.com/docs/jp/paidycheckout.html) documents
  `closed` for normal payments. Token-only `on_close` is not substituted.
- [Paidy branding](https://paidy.com/docs/jp/branding.html) example 2 allows
  logo-only; no unapproved legal/fee/deadline copy is invented.

`createInlineSdkAdapter` fully exercises create/open, validation, update/submit
and disposal through an owned, normalized driver in isolated mocks. Its driver
is an internal interface, not a guessed global SDK declaration. Browser UnivaPay
driver binding, validation recovery, accepted disposal, U12 raw Promise/event
normalization and real 3DS remain UNCONNECTED. Default mount fails closed. A
verified driver must be injected only after separate formal integration/provider
acceptance. A fixture's normalized charge ID does not prove any real SDK shape.
Unknown submit results proceed to Backend status/Webhook waiting, never guessed
charge extraction. Paidy browser adapter discards stale callbacks on disposal;
provider-owned overlay teardown/focus on logout remains Browser acceptance pending.

No new-provider Gateway is wired into the application composition in this Draft.
All three flows are Mock UI implementations pending a single published integrated
Client and provider SDK acceptance. Source Draft completion is not live connection.

## Logo delivery, legal and Production HOLD

Only supplied unmodified PNGs are added under `public/brand/payments/` and the
existing Brand resolver/manifest pipeline. All prior 25 keys and digests remain
unchanged. The 27-entry source manifest is
`sha256-e14476bb46508a7f82edab331cda7fb1b3071bda8dc63b4be693466d7ab92d12`;
only the two logos use its new immutable keys. MIME, size, count and supplied
SHA are checked; modified old assets and modified logos fail the guard.

Production Workflow remains unchanged and intentionally does not accept this
new Brand version. Later approved delivery must upload/verify the two new keys,
authorize the 27-entry version in its existing guard and verify CDN/local paths,
logo size/clearspace and mobile/desktop display. No upload or publication occurs
here. Paidy brand usage/contact and provider merchant approval remain Human
acceptance; this Source inclusion is limited to the supplied approved UI assets.
Card-brand logos are absent. Visa/Mastercard final wording, Paidy P3 commerce/
terms wording and provider-specific display conditions remain OPEN.

GTM code/configuration and Production Source Authority are unchanged. In
particular Runtime Source PR179 `7dc355d3174bdf8a4731741eea7aa4a80752b724`
continues to exclude GTM; latest main is not promoted. No Production Workflow,
ENV, AWS, DB, migration, worker, Nginx or Runtime operation is part of this task.

## Verification and follow-up

The PR records executed PASS/FAIL separately. Focused Mock tests cover API
order/availability/error/retry/stale responses, UnivaPay amount/validation/lifecycle/
known-failure/retry/charge-ID boundary, native form POST, Paidy callbacks/duplicate
confirmation, uncertain reentry, no saved-card calls, and legacy regressions.
Negative mutations run the real Payment boundary and Brand verifier. Source
inventory is updated for clean-directory CI; checks and timeout policies remain.
Auth/LINE guards additionally pin the exact opaque-attempt helper and its two
synthetic tests through reviewed-payment-storage.mjs. Any byte change fails
renewed review; negative mutations exercise both real guards. Existing analytics
storage approvals are unchanged. Production workflow tests retain prior 23/25
acceptance and explicitly reject the new Source-only 27-entry version.
The first new Mock run exposed a missing wallet fixture, corrected in source;
early concurrent local runs also hit worker-start/test timeouts under host load.
No timeout/assertion or Required Check is weakened. Final validation evidence and
fresh exact HEAD/tree self-review belong to the Draft PR, with SEV-0/SEV-1 counts.

NOT RUN: real Provider/card/JavaScript roundtrip, Browser visual/E2E, actual 3DS,
Webhook delivery, formal Client alpha.47 adoption, Build/Runtime CSP acceptance,
OLD Test, Preview and NEW Production. Still OPEN: U8/U10/U12, P1/P2/P3/P5,
T3/T4/T8 and PAY4 Capture retry specification decision. Do not infer approval.
No migration is created or applied. No financial Backend, API/schema, auth core,
ledger, draw, infrastructure or immutable artifact is changed.

Rollback is withdrawal of this unmerged Source Draft. Do not change data or
immutable assets. Retain branch/worktree; all subsequent integration, Source
merge, formal artifact and Runtime phases require separate Human GO.

Target after Draft checks/review:
`STOREFRONT_PAYMENTS_SOURCE_DRAFT_READY_PLATFORM_CLIENT_INTEGRATION_PENDING_PRODUCTION_MERGE_HOLD`.

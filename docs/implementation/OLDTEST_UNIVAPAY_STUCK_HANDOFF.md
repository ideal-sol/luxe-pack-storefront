# OLDTEST-UNIVAPAY-STUCK source handoff

Lane: **Strict Change**. Application Runtime Activation: **deferred**. Risk: R3.
Track deferred recovery and provider acceptance in Issue #201. This change is
authorized through Draft PR only; merge, deployment, new-payment enablement,
credential changes and operational reconciliation require separate decisions.

## Problem and resulting behavior

An inline UnivaPay submit could leave the site showing an opaque, full-screen
processing overlay while the SDK was validating input or performing 3DS. A
pending first-purchase payment also blocked another start while remaining outside
the existing succeeded/fincode-unpaid history filters. The original browser
failure trigger remains unconfirmed; this patch does not claim to reproduce it.

Only the inline UnivaPay flow omits that overlay. Input/validation/3DS stay visible
while purchase and method controls remain locked. After 30 seconds the site stops
awaiting the SDK, preserves its document and pending correlation, and displays a
status link for the existing payment. It does not cancel the SDK, close 3DS or
automatically navigate away. Late callbacks remain advisory and observable.

A read-only existing-payment link is outside the method loader, so it remains
available after a reload when methods are disabled or the product is ineligible.
It validates the owning session's opaque correlation against canonical
`getPayment` and the exact product ID. It never creates another payment or clears
the stored attempt. The initial-purchase eligibility rule remains Platform-owned.

## SDK evidence and privacy

The public callbacks were checked against the official
[Checkout SDK](https://widget.univapay.com/client/checkout.js), SHA-256
`bd8468535148bfa270d955e16e4c4b12d1e139eb6e376a6146847832eceae117`:
`onValidationError`, `onChargeCreated`, `onThreeDsAuthorization`,
`onThreeDsAuthorizationModalOpened`, `onThreeDsAuthorizationSuccess`,
`onThreeDsAuthorizationFailure`, and `closed`. The SDK dispatches the matching
`univapay:*` public events; this change uses instance-bound callbacks rather than
global events or private connector APIs. No callback payload or raw Promise
result is parsed. The fetched SDK establishes current public behavior, not the
exact bytes loaded in the original Human browser.

Console receives only a fixed provider label and deduplicated phase enums.
Callbacks after lifetime revocation are ignored. The unchanged Platform progress
contract supports coarse `inline_result/error` only; at most one such record per
mounted flow is sent for validation/rejection/3DS error observations. Rich phase
names stay in Console; no new server fields, endpoint or contract is invented.
No raw error, token, customer field or provider response enters telemetry.

Charge-created, SDK resolution and 3DS success do **not** mean payment success.
The browser adapter still returns `unknown`. Only canonical Platform
GET/Webhook reconciliation may settle and grant points. No new charge reporting
parser, automatic retry, refund or cancellation is added.

## Boundaries and verification

The branch is based on protected main
`3777830b38356f497cf70a9a7b30bd59bcdb25a2`; the original OLD Test source remains
`cc398cc4d943f4a426fa9540cc6258edf9bc5208`. Payment source at those bases was
equal. The active OLD Test is Next dev with recorded compiled chunk identities,
not an immutable production Build. Client/Testkit alpha.48, dependencies,
Contract, fincode, Paidy, Techcoin, GTM, rank, eligibility/accounting authority
and deployed runtime are unchanged.

Focused tests cover hanging/rejected/synchronously throwing submit, the 30s
wait boundary, late 3DS events, fixed-enum/payload-blind logs, duplicate-submit
blocking, input visibility, and pending status when new methods are OFF and the
product is ineligible. Existing payment/provider/document regressions are reused.
Exact executed results, failures and final-head self-review are recorded in the
Draft PR and worklog. Real merchant/card/3DS/browser acceptance and deployed
visual verification are deferred; synthetic tests are not provider acceptance.

## Operational recovery proposal — not executed

After separate Human approval, use the existing OLD Test Deployment/F2-B locks
and pin the current API image/source. Recheck TEST mode, new methods OFF, the
selected payment and grant count, expiry, provider TEST discovery and the full
canonical due-selection list. Proceed only if that list contains exactly the
approved payment and no unrelated target; otherwise HOLD.

The proposed single invocation is:

```sh
docker exec -e SHELL_VERBOSITY=0 <OLD_TEST_API_CONTAINER> \
  php artisan v2:univapay:reconcile --limit=1 --no-interaction
```

This is **not** an expiry-only operation: it performs provider discovery/GET and
can canonically settle a verified charge or transition an unresolved pending
payment past its deadline to expired. Stop for renewed review if discovery finds
a charge or conflicting evidence. Do not treat LIST absence as irrevocable proof
of no charge; the [official LIST documentation](https://docs.univapay.com/docs/api/charges/request/list/)
warns of lag. The command may update only the approved payment's normal status,
history/progress, classification-dependent accounting and notification records
as its existing implementation permits. No direct database update or forced
status is authorized. Capture normalized before/after evidence and run once.

Reconciliation selects payments at least five minutes old through 24 hours after
expiry. A configured worker flag alone does not start a scheduler. No new timer,
daemon, global `schedule:run`, manual point grant or history deletion is allowed
by this source task. Webhook Authorization rotation is a separate coordinated
operation; credentials are not changed here.

Before re-enabling purchases: obtain separate recovery/activation approval,
resolve the existing attempt canonically, recheck eligibility, validate the
reviewed source in OLD Test, and conduct Human-only TEST browser acceptance with
sanitized event and network status recording. Preserve all financial records.
Source rollback before deployment is withdrawal of this Draft; no runtime or
database rollback is needed for this source-only change.

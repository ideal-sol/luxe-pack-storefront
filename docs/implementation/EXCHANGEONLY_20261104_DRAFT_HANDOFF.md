# EXCHANGEONLY-20261104 Storefront Draft handoff

R3 / Strict Change / Application Runtime Activation: deferred. Issue: none.
Human authorizes implementation, push and Draft PR only. No Ready, merge,
auto-merge, release or runtime activation. Keep this branch/worktree for continuation.

Base: ba11e00741c3857764b85c18892b9ed547e40506 (live main at start).
Platform authority: PR657, squash db89dd7e4ae74bfa7fc88e28a63c0ddcb46a999a;
read its implementation handoff and spec v1.1, SHA256
57dca153e36442297cfb79c2c4e20c25b13f1575c555c547dfb629481d29a41d.
The expanded specification was available locally. The attached ZIP and
Oripoke_Codex_Storefront_ExchangeOnly_DraftPR_2026-11-04.md were not available;
the detailed latest Human request was used. Platform prompt was not executed.

## Implemented source

- Existing allowed_actions filtering, shipping minimum, SMS, addresses and
  idempotency remain authoritative. Confirmation explains excluded counts.
- Classified UI input enables the exact mixed-shipping warning and retained IDs.
  Both inventory and draw screens reconcile canonical reads before restoring
  only still-selectable, exchangeable, nonshipping retained prizes. Inventory
  fetches retained IDs individually to preserve selections beyond page one.
- Confirmed shipping remains successful if refresh fails. The modal blocks
  another shipment and offers reads-only retry; the original completion snapshot
  survives partial refreshes. Mutation errors/uncertainty never reconcile selection.
- Grouping accepts classification independently of action availability. Existing
  100-item mutation limits remain; inventory select-all/individual selection now
  also stay within 100. No classification-specific count limit is introduced.
- Purchase notice component renders exact spec wording and all target names;
  no exchange-only badges. Draw exchange estimate excludes shipping-only prizes.
- Inventory's optional server-grouped data source enables stored-default/two tabs,
  trusts the Platform result without browser status filtering, supports observer
  continuation/manual fallback, deduplicates IDs/cursors, ignores stale responses
  and resets cursors/selection on tab/session changes. Refresh resets cursor history.

## Explicitly NOT integrated / NOT complete

The shipped application still uses alpha.49 and its existing inventory route
(legacy all-status list and four tabs). No component manufactures exchange_only
or status_group on that Client. New classification inputs default to no classified
prizes; grouped loader is absent until formal adoption. The notice component is
ready but not yet connected to ordinary/login/signup Gacha detail data.

UI input callbacks are presentation seams, NOT generated API definitions or
proof that alpha.49 supports the feature. Tests inject classification and grouped
pages separately from existing alpha.49 fixtures. They do not simulate a released
alpha.50 Artifact or claim real 100-item server pagination acceptance.

## Minimum continuation after official alpha.50 publication

1. Verify actual published manifest, source SHA, immutable files and hashes,
   Client/Testkit/Public contract compatibility. Adopt exact official pins under
   the authorized adoption scope; do not reuse the unpublished candidate tgz.
2. Connect InventoryGroupLoader to the typed Client
   listPrizes({status_group: group, limit: 100, cursor}). Omit absent optional cursor
   according to the generated type. Keep server-owned hold grouping; remove
   legacy four-tab/browser-filter fallback after the new route is tested.
3. Wire isExchangeOnly from generated UserPrize.exchange_only in inventory and
   DrawResultFulfillment. Add exchange_only to the exhaustive unavailable-reason
   labels. Feed the same generated classification into grouping.
4. Mount ExchangeOnlyNotice in ordinary/login/signup purchase notices, passing
   names of generated classified lineup entries. Preserve images/ranks/cards.
5. Replace injected classification tests with official Testkit fixture integration;
   verify real stored/shipping 100-item cursors, all six shipping states and both
   hold kinds. Verify session changes, empty tabs and retained IDs beyond page one.
6. Run relevant tests and unchanged Required Checks, review exact final HEAD,
   obtain Human logged-in browser acceptance and explicit Ready/merge approval.
   Runtime acceptance/activation requires separate authorization.

## Verification and limits

Focused UI/contract checks, lint, typecheck and Artifact validation are recorded
in the PR at the exact final HEAD. Earlier failed attempts and unresolved checks
are not hidden. No local build, operational migration, Browser/E2E, logged-in
visual check, OLD Test or Production activation. Automatic CI's own required
builds/tests are distinct from release/runtime actions.

No Platform modification, dependency/lockfile/vendor/manifest change, direct API
fetch, API/schema/auth/payment/draw authority change, secret or PII introduction.
Migration created/applied: 0/0. Rollback before activation: revert this source PR.
Do not deploy alpha.49 as support for exchange-only inventory. This Draft is HOLD.

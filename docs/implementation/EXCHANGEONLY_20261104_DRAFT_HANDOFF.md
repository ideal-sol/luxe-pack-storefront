# EXCHANGEONLY PR221 formal alpha.50 integration

R3 / Strict Change / Application Runtime Activation deferred. Draft HOLD;
Ready, merge and Runtime require separate explicit Human authorization.
Starting HEAD915594aa2aa3c87d661ac35c80c187a3ad685ca6; base/main
ba11e00741c3857764b85c18892b9ed547e40506. Existing branch/worktree reused.

## Official dependency authority

Artifact13324454382, workflow41835790272 attempt1, official source
14f7819c72c5908aa6e5778303b87dc4b1202493. Ledger main
7587539aa7104db60203775c0a5813b5c8d291de records the same immutable release.
Outer ZIP67d9fbbe7c31fcfaa2ed674eeb4e35d5d60a07e01f0bb0ce34523e4783037b75;
manifest bbf4284afc47d912a13b039b7a3168fc09ae58ace682c005ef46d852e0b9c44a.
Every inner digest and SHA256SUMS verified before adoption; full hashes are in
vendor/oripa/EXCHANGEONLY-ALPHA50-20261104/PROVENANCE.md.
Client/Testkit alpha.50; Public/Admin alpha.46; Webhook alpha.45;93 operations;
Site Schema alpha.23 retained byte-identically. Prior alpha.49 files unchanged.

## Connected source

- Generated exchange_only drives grouping, exact mixed-shipping warning and
  retained acquisition IDs. No custom classification injection remains.
- Inventory defaults stored, exposes only stored/shipping, uses typed
  listPrizes({status_group,limit:100,cursor}) and trusts server filtering.
  Financial hold remains in stored; shipping-linked hold remains in shipping.
  Observer/manual continuation, repeated cursor/ID guards, generation checks,
  session unmount and canonical retained-ID reads are reused.
- Shipping/exchange targets and minimum totals use server allowed_actions.
  A/C ship; all B/D remain selected after canonical refresh, on both screens.
  Failed/uncertain/cancelled mutations keep selections. Confirmed shipping with
  failed reads offers read-only retry, with a stable completed operation snapshot.
- Ordinary Gacha and shared login_daily/signup_once detail render all classified
  prize names in purchase notices, even without other notices. Images/ranks/card
  effects remain. No customer exchange-only badges.100-operation limit retained.

## Validation and Human handoff

Official alpha.50 fixtures replace classification injections. Focused tests cover
mixed actions, minimum totals, retention, uncertain writes/read-only retry,
two tabs, query shape/cursors, six shipping states/holds and all notice surfaces.
Exact local outcomes and final-head Required5 checks/review are recorded in PR221.
An initial focused run had160 PASS,3 existing5s timeouts and1 empty-text assertion
missing punctuation; punctuation corrected. No timeout/assertion weakening.
Local full suite/Build/audit not repeated; existing Required CI performs its normal
checks. No Browser/E2E or non-running Runtime PASS is claimed.

After separate Source merge and OLD Test activation approval, Human should verify:
ordinary/login/signup notices and absence of badges; mixed A/B/C/D confirmation,
SMS/address/minimum, shipping success retention and exchange; read-failure retry;
stored/shipping scroll, tab/user switch, hold classification and mobile layout.
No Platform write, release/tag/image publication, migration000105/000106,
Runtime/ENV/Worker/Timer change. Rollback is a reviewed source revert before
activation. Actual alpha.50 Runtime compatibility and Human acceptance remain
release/activation concerns; no Ready or merge is authorized here.

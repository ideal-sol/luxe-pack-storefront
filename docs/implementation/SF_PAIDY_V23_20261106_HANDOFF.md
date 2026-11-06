# SF-PAIDY-V23-20261106 — Source handoff

R3 / Strict Change / Application Runtime Activation: deferred. Issue: none.
Human authorizes Draft PR only; Ready, merge and Runtime activation are prohibited.
Base: `06b669e3e8356ba25a0236631bdb9b27064fe00d`.
An isolated task worktree protects the occupied Storefront working directory and
its existing detached HEAD/configuration edits. Platform remains READ-ONLY.

## Contract and Source

Authority: [Platform PR662](https://github.com/ideal-sol/oripa/pull/662), squash
`417b5558d6dc439605c57685c6972c6300b2842b`,
`openapi/public/paidy-schemas.yaml` (also read from live main; blob
`6b56b17f196d74358389dc3bf15c6797b839fefb`). D1–D5/H1–H8 remain Platform
responsibilities; this change implements only the Checkout buyer-data boundary.

The existing action validator accepts and checks the five additional fields:

| Field | Validation |
| --- | --- |
| account_registration_date | Required real calendar date, YYYY-MM-DD; no normalized invalid dates |
| delivery_locn_type | Optional nonempty string |
| days_since_first_transaction | Optional nonnegative safe integer |
| previous_payment_methods | Required object, required credit_card_used boolean; optional convenience_store_prepayment_used and bank_transfer_used booleans; no other keys |
| order_item_categories | Optional nonempty array of nonempty strings |

Optional absence is accepted. Unknown fields and malformed values fail closed.
Existing user/age/ltv/history/balance, amount, order and item checks remain.
The validated original action/payload is returned without copying, calculations
or additions. No generated Client types or packages are regenerated or replaced;
the existing alpha.50 type projection remains sufficient for SDK forwarding.
Synthetic Storefront-only fixtures model the Public v2.3 contract.

Official Script/configure/launch, document ownership, callback claiming, session
abort, idempotency, CSRF and canonical payment status flows are unchanged.
Authorization alone never establishes success or grants coins; Laravel retains
Capture/settlement/grant authority. Automatic Capture retry remains prohibited.

Human's 2026-11-06 Paidy answers are accepted as input: digital-goods no-shipping
mode enabled at Paidy; delivery location optional; category コイン accepted;
shipping address omitted; Checkout collects needed billing information; absent
first-purchase history may be omitted. No new address form or Capture behavior.

Paidy and NetRideCash remain excluded from new purchase selection, including URL
selection. No flags, ENV, labels, order or logos change. Existing history remains.
UnivaPay, fincode/3DS, plans, status/Polling, refund/chargeback, Auth, SMS, rank,
Draw and other business behavior are out of scope.

## Formal Artifact hold

Live Platform Release Ledger blob `97ba6fa3aba2037ecb6fdef439d5e807bb962193`
reports latest immutable Client/Testkit `2.0.0-alpha.50`, candidate null.
The adopted `vendor/oripa/EXCHANGEONLY-ALPHA50-20261104` manifest SHA-256 is
`bbf4284afc47d912a13b039b7a3168fc09ae58ace682c005ef46d852e0b9c44a`;
Public/Admin alpha.46, Webhook alpha.45, Site Schema alpha.23 are retained.
Manifest/TGZ/OpenAPI/checksums, package.json and lockfile remain byte-identical.
Source readiness does not mean formal v2.3 Client/Testkit adoption or Runtime
acceptance. No alpha.51 publication, ledger update or unofficial package adoption.

## Validation and remaining work

Focused actions/SDK/UI: 129 PASS. Includes all five fields, optional omission,
calendar/leap validation, required/optional booleans, unknown keys, original
payload identity, authorized/rejected/closed/unknown callbacks, duplicate callback,
session teardown and real new-purchase hiding policy. The UI regression scope
uses its existing test-only gateway/SDK mock; production visibility is unchanged.
Additional regression, lint/typecheck, boundaries and Artifact results plus exact
final HEAD/Tree, Required5 and machine-readable Strict self-review are recorded
in the Draft PR to avoid a self-referential commit. CI keeps its normal full
suite and two clean-directory builds; no extra local build or manual CI rerun.
Initial additional regression run: 196 PASS / 4 FAIL, with all four failures
caused by stale whole-file reviewed-payment-storage hashes for the two edited
tests. Reviewed their complete changes: no additional browser storage, sensitive
values or permission expansion. Renewed only those exact hashes; no exemptions,
storage behavior, boundary rules or assertions were weakened. The negative
mutation tests must pass again with the renewed hashes.

Browser/visual/E2E, Preview Runtime Acceptance with formal v2.3 Artifact,
real provider calls/authorization/Capture/Webhook and Production: NOT RUN.
No successful Runtime or Browser acceptance is claimed from jsdom Source tests.
After formal alpha.51 publication and separate Human approval, verify its release
authority/digests, adopt exact coherent Client/Testkit, rerun contract/payment
checks and obtain Browser/Preview acceptance. Real connectivity and a separate
Human GO are required before new Paidy purchase visibility or Production use.

Migration creation/application, DB, Runtime, ENV, Secret, Worker/Scheduler and
Publication changes: 0. No financial/infrastructure changes. Rollback before
activation is withdrawal or a reviewed Source revert; never mutate ledgers.
Draft branch/worktree are retained for Human review; no merge cleanup applies.

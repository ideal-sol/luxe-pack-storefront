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
or additions. The formally published alpha.51 Client/Testkit are now adopted
without regeneration or repacking. The official Testkit first-purchase fixture
is tested unchanged; optional-field and UI scenarios extend that same fixture.

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

## Formal alpha.51 Source adoption (2026-11-08)

The latest Human instruction supersedes the original Artifact-adoption hold.
Source [PR670](https://github.com/ideal-sol/oripa/pull/670), squash
`705d03caab389c0f9600b3e85420532aa6d46439`; Ledger
[PR671](https://github.com/ideal-sol/oripa/pull/671), squash
`0ecc2d208240aa8a3401d186a57a52fa7734d636`.
Live protected Platform main and its formal ledger match that Ledger SHA:
latest immutable alpha.51, candidate null, all 30 predecessor records preserved.
Exact-ID download/readback of Artifact `13566710138`, publication
[run42352571854](https://github.com/ideal-sol/oripa/actions/runs/42352571854),
attempt1, verified all six digests against the Human instruction and ledger.
The five official files are copied unchanged to
`vendor/oripa/PAIDY-ALPHA51-20261106`; see its [PROVENANCE](../../vendor/oripa/PAIDY-ALPHA51-20261106/PROVENANCE.md)
for the complete hashes. Client/Testkit/bundle alpha.51, Public/Admin/Webhook
alpha.47, referenced Site Schema alpha.23; contract-breaking, breaking_change=true.
Only the two approved Paidy fields become required. Full Public comparison
rejects any change outside the five published buyer-data fields/document version.

Package, lock and Client override use exact official TGZ paths. External package
versions/integrities/graph remain unchanged. All historical Vendor bytes,
including alpha.50, are preserved. Artifact negative tests reject modified
Manifest/TGZ/OpenAPI/SHA256SUMS, unknown files and mixed package/lock versions.

Production Source/Artifact/Workflow Authority remains the existing alpha.50:
`docs/production-approved-source.json` and the strict Production Provenance
validator are unchanged. An additional negative test proves development
alpha.51 pins cannot satisfy that alpha.50 Production approval. No new Runtime
approval follows from Source adoption. Platform remains READ-ONLY.

## Validation and remaining work

Original alpha.50 Source actions/SDK/UI: 129 PASS (historical). Includes all five fields, optional omission,
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
First automatic CI: policy/quality/security PASS, integration2081 PASS/2 FAIL
because the new synthetic fixture needed a row in the exact Source Inventory.
Added that row without changing rules/assertions; final-head CI is renewed by
normal Push. No manual CI rerun; no build ran in that initial failed integration.

Current adoption verification uses the formal alpha.51 fixture and HTTP version
header, all affected contract tests, Paidy SDK/UI, other-payment/Polling/session
regressions, Artifact/Provenance/Boundary/security/source-inventory checks and
lint/typecheck. Actions/SDK/UI130, Production Provenance131 and additional focused
regressions747 PASS; Artifact/policy/all nine boundaries/secret/lint/typecheck
PASS. Final-head CI/review are recorded in PR228 and the Worklog.
The edited action test was fully reviewed before renewing
its one storage-review digest: no new storage access or relaxed boundary.

Browser/visual/E2E, Preview/OLD Test Runtime Acceptance: NOT RUN (Human確認予定).
The latest explicit Human instruction schedules logged-in Browser Acceptance
after a separately authorized Source merge and OLD Test reflection. No Preview
environment or Codex login is needed for this Draft. Real provider calls,
authorization/Capture/Webhook and Production: NOT RUN. jsdom tests are Source
evidence only. Separate Human GO remains required for merge, OLD Test, Production
and Paidy visibility, with Human OLD Test acceptance before Production activation.

Platform Composer advisories remain unresolved: 12 (High4/Moderate5/Low3;
Critical0). Runtime Security Posture remains HOLD. This adoption does not resolve
or approve them; future Runtime work requires a separate security decision.

Migration creation/application, DB, Runtime, ENV, Secret, Worker/Scheduler and
Publication changes: 0. No financial/infrastructure changes. Rollback before
activation is withdrawal or a reviewed Source revert; never mutate ledgers.
Draft branch/worktree are retained for Human review; no merge cleanup applies.

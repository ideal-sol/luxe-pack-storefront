# SF-LINE-ALPHA52-20261110 — LINE Storefront handoff

- Risk: R3 / Lane: Strict Change
- Application Runtime Activation: deferred
- Base: `2218be7337bc59d7248fdd890c11df6df724a528`
- Tracking: https://github.com/ideal-sol/luxe-pack-storefront/issues/232
- Delivery boundary: Source implementation, tests and Draft PR. Ready / Merge require a separate Human decision.

## Formal Artifact

Adopts the original five GitHub Artifact files under `vendor/oripa/LINE-ALPHA52-20261110`.
See `PROVENANCE.md` there for all SHA256 values and publication / Source / Ledger links.
Artifact `13742019147`, run `42772928571`, Source `8d56c5e1d450e4bc9ee07c1c97886aad054c02ee`.
Live readback verified the exact Artifact identity, outer digest, five inner digests,
successful authorize / publish / readback jobs, and protected Platform main Ledger
`5bc7a904a04522334d2a28b413bb84ac6f0332cf`: latest immutable alpha.52, candidate null.
Client / Testkit alpha.52, Public alpha.48, Admin / Webhook alpha.47,
Site Schema alpha.23 referenced. No regeneration, repack or generated-file edits.

alpha.51 and earlier vendor evidence stays unchanged. The validator retains the
complete Paidy v2.3 predecessor comparison, checks the precise LINE additive delta,
and rejects mixed versions, modified bytes and unrelated contract changes.
Existing Production Source Authority is unchanged; its alpha.51 validation remains
independent and explicitly rejects unapproved alpha.52 development pins.

## Reused implementation

The existing MyPage navigation renders the fixed LINE menu without LINE API reads.
`LineAccountLink`, SessionProvider and ExternalIdentityClientProvider continue to use
`listExternalIdentities`, `getLineFriendState`, `startLineIdentityLink` and
`startLineReauthentication`. Reward copy uses Platform presentation only; claimed
rewards never display an inferred historical amount. Friend state stays separate.
Only `secondary_action.code=start_friendship_recheck` enables the recheck button.
Both starts reject unsafe URLs and prevent duplicate submissions. Callback notices
are read through the Client, including effect replay protection for one-time reads.
The UI never handles OAuth callback credentials or grants points.
The read cache and ready presentation are bound to the current Session snapshot;
refreshing Session cannot redisplay an already consumed callback result while a
fresh read is pending. The regression test covers that loading interval as well.

Human specifications 1–13 are maintained within the Storefront scope; decision 14
and LPlus O2–O7 remain excluded. No new login / unlink UI, provider payment logic,
Platform, Admin, database, migration or ENV implementation is included.

## Validation

- Official live Artifact / Ledger readback and `pnpm artifact:check`: PASS.
- Policy, LINE identity boundary and secret checks: PASS.
- Full Lint and final Typecheck: PASS; scoped Lint repeated after the final LINE edit.
- Focused tests: 17 files / 451 distinct cases PASS, reusing valid completed results.
  Includes LINE UI (32), friend-state contract, MyPage, member rank, payment Client,
  Paidy v2.3 provider actions, updated Client boundaries, vendor tamper rejection,
  and retained Production provenance.
- Initial MyPage test retained the old hidden-menu expectation; updated and passed.
  Initial Typecheck found the canonical reauthentication options argument required;
  supplied `{}` and reran affected checks successfully.
- Required CI: to be recorded on the exact Draft PR head after its automatic run.
- Browser / live LINE OAuth / OLD Test acceptance: NOT RUN; Runtime Activation deferred.
- No local application Build; existing Required CI performs its normal builds.

## Later OLD Test acceptance (separate authorization)

Use the final approved Source and formal alpha.52 Artifact; do not rebuild the
Contract bundle. Validate the Platform Public alpha.48 compatibility and runtime
Source before switching Storefront. Production Authority / build authorization
must be handled by the separately approved deployment task.

The integration includes Platform LINE Source PR #665 and previously merged Admin
UI PR #663. The OLD Test operator must build / reflect both API and Admin and check
the Admin screens, including ADMIN-UI-001–016 / 018 and mail template editing for
`phone_changed`, `account_closure_payment` and `account_closure_code`.
Storefront does not reimplement those screens.

Platform Migration 000107 and approved LINE provider / feature / reward settings
must be checked by the Platform operator in that separately authorized task.
This change applies no migration and edits no operational configuration.

Check real-browser LINE link / reauthentication return, current Session retention,
friend state, enabled / disabled and already granted rewards, one-time callback
errors, duplicate clicks, mobile layout, and Paidy v2.3 / member rank / MyPage
regressions. Never infer a reward grant from the Frontend display. A successful
link or Session must survive friendship-check / reward-apply failure.

Runtime, ENV, Worker, Timer and DB changes in this task: **0**.

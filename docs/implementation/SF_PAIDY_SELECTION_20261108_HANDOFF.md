# SF-PAIDY-SELECTION-20261108

Risk R3 / Lane: Strict Change / Application Runtime Activation: deferred.
Issue none. Human authorizes Source and Draft PR only; no Ready or merge.
Base: b0b38bee37bf9068888067f241af17964584cd92.

New-purchase filtering excludes only NetRideCash. Paidy is presented only when
returned by the canonical API, preserving order, label, flow and availability.
Existing selector and purchase guards reject unavailable/unsupported methods,
including URL requests; no missing method is invented. No new flag or form.
Paidy SDK, callbacks, session/document lifecycle, CSRF, Idempotency, Capture,
settlement and coin-grant authority are unchanged. Laravel remains authoritative.

Updated selection tests use the real filter and existing Gateway/SDK mocks.
They cover API order, radio selection/Checkout launch, absent/unavailable Paidy,
URL fallback, NetRideCash hiding and existing card behavior. Existing authorized
confirmation wait, rejected/closed/unknown, duplicate and session-end regressions
remain. Full-file storage review is renewed only for the edited UI test; no
storage logic or boundary rules change. Boundary negative tests remain required.

Formal Client/Testkit alpha.51, all Vendor/Manifest/Digest/package/lock files and
Production alpha.50 Source/Artifact/Workflow Authority are unchanged.
Focused test, Artifact, Payment/Auth/Session boundary, lint/typecheck, Required5
and exact final-head review results are recorded in the Draft PR and Worklog.
No extra local Build or manual CI rerun; normal CI retains its required builds.

Browser/OLD Test/Preview Runtime Acceptance: NOT RUN (Human planned after
separately approved Source merge and OLD Test reflection). No login, real Paidy
payment/Capture/Webhook or runtime activation. Platform Composer12 advisories
(High4/Moderate5/Low3) remain unresolved; Runtime Security Posture remains HOLD.
Production Paidy enablement requires separate Human judgment.
Migration/DB/ENV/Secret/Worker/Scheduler/Runtime changes0. Platform READ-ONLY.
Existing detached checkout and its configuration edits are preserved.
Rollback before activation is withdrawal of the Draft or a reviewed Source revert.

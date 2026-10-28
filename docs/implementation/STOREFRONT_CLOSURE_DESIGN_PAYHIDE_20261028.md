# Storefront closure, design and new-purchase visibility

Change: SITE-CLOSURE-DESIGN-PAYHIDE-20261028. Transport policy: PAYHIDE-20261028.
Issue: #195. Strict Change / R3 / Application Runtime Activation: deferred.
Base / PR #194 squash: 5d7e1d25d264f6b619e4ddaec70f07c2c524b7d4.
Branch: feat/SITE-CLOSURE-DESIGN-PAYHIDE-20261028. Dedicated worktree retained.

## Authority and implementation

All three supplied hashes matched:
- v1.4: c07dcec10dda7cafb06c11787345681b4e2a5b6aadb12658477f9fb0771437ee
- closure HTML: 285578032af9b2b60ad294094d877f06f30663b5770c25a3c0f118541ea74619
- design ZIP: 173925100c061d2a5ff0e2034e9cb0a74e742b9fb23c8ec4065034f9062afcf6

Applied individual patches 0001, 0002, 0003, 0004 once, in order, with git apply --3way; no conflicts, no all-in-one duplication. Kept PR #194 draw/audio/Skip files unchanged. Added brand mark and member-ID copy/toasts, expanded gacha conditions, PICKUP/flow design, beginners route, account-closure entry, coin rate notice and contact return link. Added source inventory entries. Corrected the ZIP's underage consent and blanket 180-day expiry language to the existing 18+ and paid-point policies. Refund/shipping rules are not newly decided here.

New-purchase visibility is centralized in newPurchaseMethods, applied after canonical method validation and before the purchase form receives options. Paidy and NetRideCash cannot be selected from API options or URL; existing selections cannot resolve to them after options reload. Hidden-only results produce the empty state. Other methods preserve their availability/flow/saved-card controls. Provider hooks, SDK, past history, status and return paths are unchanged. Original provider behavior assertions are retained with an explicit presentation-policy test seam; five new integrated cases exercise the real policy (both URL methods, hidden-only methods and unavailable credit card). No production switch bypasses this policy.

## Closure contract pending

Live Platform PR #631: Draft, not merged, head 7046094e5d7b4adbe11890ee6b7519db6c19103e.
Live protected-main publication ledger: latest immutable alpha.47, candidate null.
Client and Testkit remain exactly pinned to verified alpha.47; dependencies and immutable vendor files are unchanged.

The online closure screen is implemented against an explicitly UI-only view model, with preview counts/conditional shipping text, password visibility, numeric OTP, server-directed resend/expiry, consent, stable operation key, synchronous duplicate-submit guard, safe errors, stale-preview reload and re-consent, and suppression of completion after unmount. The future canonical adapter entry invalidates local session state and emits the approved one-time toast before replacing the route with home. Internal financial/hold/reservation/reuse classifications are not exposed.

The actual route intentionally shows the existing generic unavailable state for authenticated visitors, loading state during session loading and login state for anonymous/expired sessions. It does not present mock balances, contact-only closure, a fabricated Client method or a direct API request. Online closure is NOT operationally complete. Pending: formal immutable closure-capable Client/Testkit publication, provenance validation, canonical adapter mapping of preview/errors/CSRF/idempotency, and real contract/browser acceptance. Gate email/SMS failures separately from the HTML's payment-processing block. A future adapter must be scoped to the current session identity and mounted anew when that identity changes.

## Verification and review records

Frozen dependency installation, typecheck, secret scan and artifact checksum/provenance validation PASS. First CI run40687197126: 1771 tests PASS, 4 boundary tests FAIL due to the deliberately exact storage-review digest of the modified synthetic test. Re-reviewed unchanged storage behavior and updated only that exact digest; retained negative mutation assertions and no exemptions. Closure retry time now uses React state after lint found render-time ref reads. All final-head CI must pass after these fixes. Focused UI, design and provider regressions, lint/typecheck/build and normal CI are executed/observed separately; the final fixed-head PR evidence is the authority for final results. The initial local command accidentally passed a literal -- before file filters and ran the full suite; it was stopped after severe host contention caused timeouts. A focused forks run could not start workers. These are failed/interrupted runs, not PASS. No test assertion or CI timeout is weakened. Final results and any subsequent corrections are recorded in the PR evidence.

Browser/PC-SP visual acceptance, real merchant/provider, real OTP delivery and deployed closure acceptance are NOT RUN in this source-only task. Mock UI success does not establish a working Platform closure flow. Preview Runtime Acceptance remains required before eventual activation.

No migrations created/applied. No API/database/point/payment/draw authority changes. Platform, infrastructure, production configuration, artifact publication, OLD Test and NEW Production remain untouched. Ready, merge, auto-merge and runtime activation are prohibited; leave the PR draft=true, merged=false, auto_merge=null. Task branch/worktree retained. Source rollback is a separately reviewed revert; no runtime rollback required.

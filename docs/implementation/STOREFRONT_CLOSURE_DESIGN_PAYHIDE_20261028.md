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

## Formal alpha.48 closure connection

Continuation Human instruction: use the same PR196, branch/worktree and Change; no new PR/Issue, Ready, Merge, publication or Runtime activation. Formal Platform PR631 squash6e945df343d3d42ffa844b3b369ca0c171a6bbbe; ledger PR632 squash7a28936be4cbd89b070c5565a20a3fe678b7916b. Live latest immutable alpha48/candidate null verified before adoption.

Downloaded exact formal Artifact ID12819254428 from publication run40697440380 (attempt1,3/3 successful jobs). Outer and all inner SHA256, Manifest/source checked. See vendor/oripa/CLOSURE-ALPHA48-20261028/PROVENANCE.md for exact five file hashes. Client/Testkit2.0.0-alpha.48/Public alpha44 are exactly pinned, including override and lockfile. Previous immutable vendor artifacts and Site Schema alpha23 unchanged. No unrelated dependency movement. Artifact gate preserves all historical checks and adds exact alpha47 retention, unchanged previous paths and the three closure operations.

The product route now uses createStorefrontIdentityClient through createBrowserPlatformTransport. A typed display adapter validates preview/timestamps/success and safely maps ApiProblemError. The canonical Client supplies CSRF, credentials and the stable Idempotency-Key; no direct fetch/SDK/domain logic. The server owns email/SMS eligibility and financial behavior. Password/OTP, resend/expiry, duplicates, STALE reload/re-consent and uncertain-retry key are preserved. Server success explicitly rebuilds the browser Auth Client to discard its cached CSRF initializer, clears old SMS request ownership, invalidates local session ownership, discards the session-scoped adapter and emits the approved single toast/home transition. Different-member login remounts the flow and ignores late prior-member completion. Internal financial/hold/reservation state remains absent from UI.

Result target: STOREFRONT_CLOSURE_DESIGN_PAYHIDE_DRAFT_READY (Source and isolated contract acceptance only). Actual backend activation, real Browser/OTP/mail/provider and Preview Runtime Acceptance remain NOT RUN and are separate release conditions. Existing design/payment visibility and all provider/history/return Source remain unchanged by this continuation.

## Verification and review records

Continuation: formal Artifact/frozen install/Auth/Payment boundaries PASS. Initial typecheck found exact-optional-property mismatches in the new adapter, corrected without casts that conceal undefined verification. Current focused tests/lint/typecheck and final CI results are recorded in the new fixed-head PR evidence. Local high-contention timeouts remain non-PASS. Existing Production-authority rejection is preserved; browser acceptance script header expectation moves to the formal Client version without claiming a Browser run.

Prior Draft phase history:

Frozen dependency installation, typecheck, secret scan and artifact checksum/provenance validation PASS. First CI run40687197126: 1771 tests PASS, 4 boundary tests FAIL due to the deliberately exact storage-review digest of the modified synthetic test. Re-reviewed unchanged storage behavior and updated only that exact digest; retained negative mutation assertions and no exemptions. Closure retry time now uses React state after lint found render-time ref reads. All final-head CI must pass after these fixes. Focused UI, design and provider regressions, lint/typecheck/build and normal CI are executed/observed separately; the final fixed-head PR evidence is the authority for final results. The initial local command accidentally passed a literal -- before file filters and ran the full suite; it was stopped after severe host contention caused timeouts. A focused forks run could not start workers. These are failed/interrupted runs, not PASS. No test assertion or CI timeout is weakened. Final results and any subsequent corrections are recorded in the PR evidence.

Browser/PC-SP visual acceptance, real merchant/provider, real OTP delivery and deployed closure acceptance are NOT RUN in this source-only task. Mock UI success does not establish a working Platform closure flow. Preview Runtime Acceptance remains required before eventual activation.

No migrations created/applied. No API/database/point/payment/draw authority changes. Platform, infrastructure, production configuration, artifact publication, OLD Test and NEW Production remain untouched. Ready, merge, auto-merge and runtime activation are prohibited; leave the PR draft=true, merged=false, auto_merge=null. Task branch/worktree retained. Source rollback is a separately reviewed revert; no runtime rollback required.

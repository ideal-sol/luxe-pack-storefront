# SITE-GTM-20261026 — GTM Source / Production handoff

R3 / Strict Change. Application Runtime Activation: none.
This change stops at a dedicated Draft PR, focused validation and fixed-head
self-review. Merge, Artifact Dispatch, Production Authority changes, ENV changes
and all existing OLD / OLD Test / Preview / NEW Production runtime operations are
outside this authorization.

## Source behavior and patch corrections

The supplied patch applies cleanly to protected main
`00e10604ee262470a96f4c392d2c3b4f2511e98a`.
It adds conditional GTM Script / noscript composition and a single analytics call
after successful initial SMS verification. Authentication, the canonical Client,
SMS requests, refresh, reauthentication and preregistration completion remain
unchanged. No payment-completion or other conversion event is added.

- Missing or invalid `NEXT_PUBLIC_GTM_ID` produces no GTM Script or
  noscript iframe. Both analytics entry points return before even reading
  dataLayer or localStorage getters. `NODE_ENV=production` alone is insufficient.
- Next config embeds the value, including an explicit empty string for an unset
  build, into server and client code. Runtime ENV cannot enable an unset build.
- The patch originally emitted events while GTM was unset and allowed abnormal
  dataLayer values to throw into the SMS success path. Both are corrected.
  Storage getters/read/write failures and malformed/frozen/throwing dataLayer
  values are contained inside analytics. An unsent event is not marked as sent.
- `registration_complete` is emitted only after a successful
  `verifySmsCode` result with `verified=true`, when the prior SMS state was
  unverified and this is not a phone change. Failed OTP, existing verified-member
  display, status polling and phone changes do not emit.
- dataLayer receives exactly `{ event: "registration_complete" }`.
  No user ID, phone, email, OTP, challenge ID or preregistration data is included.
- localStorage suppression is best effort for the same user in the same browser
  profile and origin. Independent browsers/devices/storage partitions, storage
  deletion or denied storage can permit another send; it is not globally unique
  or an accounting record. The short user-key hash is pseudonymous, not
  anonymization, and can collide. Concurrent tabs are not an atomic exactly-once
  guarantee. Do not advertise complete uniqueness.
- The existing Auth boundary scanner initially rejected the patch's storage use.
  Its authentication/session storage ban and existing checks remain in force.
  Only the exact SHA-256-pinned contents of this non-authentication marker helper
  and its two focused tests are recognized as reviewed analytics storage. Any
  edits require renewed review and digest updates. Mutation tests reject added
  arbitrary writes, unreviewed paths, direct API and browser-protocol leakage;
  there is no general analytics-directory or authentication-storage exemption.

## Environment boundary

| Build | GTM input | Script / iframe / registration event |
| --- | --- | --- |
| OLD site / currently running OLD Test release | No reflection in this task | Existing bytes and ENV untouched |
| Future OLD Test / Preview / ordinary CI build | Unset | Disabled |
| Isolated configured build test | Synthetic `GTM-TEST0001` only | Offline output inspection and inert tests; no container requests |
| Formal approved NEW Production Artifact build | `GTM-5DQRPNN2` | Enabled in its compiled bytes, subject to later Human approval |
| NEW Production build without the input | Unset | Disabled even with production NODE_ENV or later runtime ENV |

No actual GTM container is loaded by focused tests. The Script component is
mocked inert; static render and build inspection do not execute browser scripts.
Production measurement acceptance is pending and must be done separately.

## Production workflow integration design (not implemented here)

PR #184 is already merged, despite the original request describing it as Draft:
[PR #184](https://github.com/ideal-sol/luxe-pack-storefront/pull/184),
Squash `00e10604ee262470a96f4c392d2c3b4f2511e98a`.
Its three exact Next.js 16.4.2 guards are present in this change's base.
Do not modify its branch, reuse its workflow-only SHA as the application source,
or undo its guards.

Recommended sequence:

1. Review this Source Draft and its acceptance evidence; any Source Merge needs
   separate Human authorization. Before merge, satisfy Required Checks, fresh
   exact-head review and affected-flow acceptance without live GTM advertising
   requests. No existing runtime is changed here.
2. Prepare a separate narrow Production Workflow PR on the then-current protected
   main after #184 (already satisfied), preserving the merged exact-version guards.
   Review changes against any newer workflow edits before integration.
3. In `.github/workflows/production-artifact.yml`, set
   `NEXT_PUBLIC_GTM_ID: GTM-5DQRPNN2` only on the
   `Build exact production application` step. Do not set a repository-wide,
   job-wide, test-wide, Preview or ordinary CI ENV value. Use a separately named
   non-secret expected metadata constant for verification; never enable the real
   container in validation tests.
4. Extend the existing production manifest with a reviewed explicit pair such as
   `gtm_id: "GTM-5DQRPNN2", gtm_enabled: true`
   (disabled builds: `gtm_id: null, gtm_enabled: false`).
   Reject invalid IDs, wrong ID/state pairs and missing metadata. Bind the pair
   to an observation of actual output, not merely the input ENV.
5. Verify compiled client and server outputs and rendered root HTML with the
   runtime GTM ENV unset or poisoned. Check the exact loader container ID,
   noscript URL and the compiled event gate. A raw substring search or a metadata
   marker alone is insufficient to establish behavior. Use offline/mocked
   resources for behavioral checks. Disabled builds must render neither tag and
   must leave storage/dataLayer untouched when the SMS event handler runs.
6. Run those same checks against the packaged filesystem release before upload
   and the exact-ID re-downloaded payload. Compare the observed ID/enabled state
   to the inner and outer manifests, Build ID and expected metadata; include any
   build-observation file in FILE_SHA256SUMS. Retain archive / manifest / payload
   hashes, manifest comparison, Git tree, source_sha, workflow_sha, ARM64 smoke,
   immutable upload and exact-ID download/digest checks.
7. Extend existing workflow tests with wrong/missing ID, wrong enabled state,
   disabled output, mismatched packaged bytes and redownload tampering cases.
   Preserve all Security checks, thresholds, permissions, Source/Contract
   authorization, pinned Node/pnpm and all three exact Next.js 16.4.2 checks.
8. Obtain separate Human approval for the exact merged application Source and
   Production Source Authority before any authorized formal Artifact Dispatch.
   Workflow Merge does not authorize Runtime Source or Activation.

The current checked-in Production Authority still pins PR #175 / alpha.45,
whereas current application main pins Client/Testkit alpha.46. This task does not
resolve or bypass that difference. A GTM artifact must use a separately approved
exact GTM-containing application SHA and compatible immutable Contract pins;
latest main and PR #184's workflow SHA are not substitutes for that decision.

## alpha.46 and a later Storefront-only delivery

Existing released artifacts, Stable Tags and OLD Test runtime bytes cannot be
patched or overwritten. An artifact already built without GTM cannot gain it
through a runtime ENV change.

If “include in alpha.46” means the pending NEW Production delivery window,
inclusion is possible only after Source and workflow reviews/merges, affected SMS
and preregistration acceptance, exact new Production Source Authority and Human
approval, followed by a newly generated and verified formal Storefront Artifact.
The already pinned alpha.46 Platform Contract may be retained if compatibility is
verified; this Source-only analytics change does not itself require a Platform
release or Contract republication. Reuse neither an old Storefront archive nor
its hashes for new GTM bytes.

For later Storefront-only delivery, keep the approved compatible Platform runtime
and immutable Client/Testkit/Contract pins, prove no API/DB/auth protocol/point/
payment/draw authority changes, and repeat the applicable Storefront release,
Security, Source Authority, artifact/provenance and affected-flow acceptance
gates. Separate Human approval must cover Dispatch and NEW Production Activation.
Do not change the running OLD Test release to achieve either path. No migrations
are created or applied here.

Rollback uses a retained, previously approved immutable Storefront Artifact,
including its recorded GTM state, through a separately authorized runtime task.
Source rollback is a reviewed revert. Turning GTM tags off in the GTM console
can stop configured advertising tags but does not change compiled GTM loader
bytes or replace a formal artifact rollback.

## Human GTM console handoff

Source tag installation and advertising conversion configuration are separate.
Human must:

1. Create a custom-event trigger with the exact event name
   `registration_complete`.
2. Attach the intended advertising conversion tag(s), with the correct
   conversion destination and the approved consent/configuration policy.
3. Review the container for unintended automatic page/URL/form/user data capture;
   the app event payload itself contains only the event name. The Source change
   does not certify third-party container tags or introduce a consent policy.
4. Publish the reviewed GTM container version.
5. After separately approved NEW Production activation, verify one initial SMS
   success and expected conversion delivery on the real site. Separately confirm
   failed SMS, phone change and already verified redisplay do not convert; account
   for browser-only suppression when interpreting counts.

SPA page-view measurement, if required, is a separate GTM history-change trigger
decision. Payment completion and additional events remain out of scope.

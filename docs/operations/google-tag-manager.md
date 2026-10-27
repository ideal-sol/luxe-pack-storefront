# SITE-GTM-20261026 — GTM Source / Production handoff

## GTM-SOURCE-AUTH-20261027 — Authority Draft candidate

The dedicated Authority Draft is based on protected main
`9702793ec7fdad4332e634b230dc6661ff176655`, the merged PR189 Workflow.
It proposes `source_pr=186` and Application Runtime Source
`2be4169fd847d18d8de0f5bacc1b4a4d7c416b05`, tree
`81a65d46638dbf2c832c6f5b263424096e0328de`. The Workflow merge, latest main
and a future Authority merge are not substitute application Sources.

Formal Human Source GO has not been issued. `activation_authorized=false` remains.
The candidate description begins `Draft candidate exact Runtime Source:`; the
unchanged production authorization guard requires `Human-approved exact Runtime Source:`
and rejects this Draft wording before any GitHub authority lookup. Later explicit
Human Source GO must be recorded through a reviewed promotion of that description,
with fresh final-head checks/review; do not bypass the guard. Ready/Merge and formal
Build/Dispatch/Stage/Runtime Activation are outside this Draft authorization.

Human reports `OLDTEST_PR186_GTM_DISABLED_FINAL_ACCEPTANCE_PASS` for the exact
PR186 Source / Next16.4.2 / alpha.46 / GTM OFF. Technical Acceptance is PASS;
Human Browser Acceptance5/5 PASS covers only the five handoff items. Real SMS
success/failure, phone-number change, verified redisplay and GTM ON measurement
remain separate Production Acceptance items. No new Runtime acceptance is run here.

The Draft preserves every alpha.46 Artifact12586773046 / Client / Testkit / OpenAPI
pin and checksum, Platform Runtime Source `3592fcdc8e43467c3dd67d2677ec52b7d328eb77`
and Platform Authority `0372d25ea61a4e6f15485568819f8f1029443b73`. No dependency,
vendor, Workflow, application or Platform change is made. Existing published
Artifacts and rollback assets remain untouched. Current protected main retains
the PR179 Authority until a separately approved change is merged.

The sections below are historical Source/Workflow preparation records. PR189 is
now merged and the five-item OLD Test PASS is reported above; their earlier
Draft-only permissions and missing-report statements describe those past stages.

## GTM-PROD-WF-20261027 — Production Workflow preparation

The dedicated Workflow change is prepared against protected main
`ab52ea83c5a812be0c215b958e64cd01a84720ea`. It sets
`NEXT_PUBLIC_GTM_ID=GTM-5DQRPNN2` only on `Build exact production application`.
Validation tests, ordinary CI, Preview and OLD Test receive no real GTM build input.
Implementation, tests and a Draft PR are authorized; Ready, Merge, auto-merge,
formal Artifact Dispatch and Runtime Activation remain unauthorized.

Application Runtime Source candidate: PR #186 merge
`2be4169fd847d18d8de0f5bacc1b4a4d7c416b05`, tree
`81a65d46638dbf2c832c6f5b263424096e0328de`.
The reported OLD Test reflection uses this Source / Next16.4.2 / alpha.46 / GTM OFF.
Reflection completion is not Human Browser Acceptance. A formal PASS report tied
to that Source, Build ID and affected registration/SMS/preregistration flows must
be confirmed separately before Production approval.

Current `docs/production-approved-source.json` instead pins PR #179
`7dc355d3174bdf8a4731741eea7aa4a80752b724`, without GTM. That Authority file is
unchanged. Existing exact Source authorization runs first; the new reviewed-source
check then rejects PR179 before any GTM Build. Workflow preparation never promotes
PR186 or latest main to Production Source Authority automatically.

`scripts/verify-gtm-build.mjs` validates the reviewed PR186 composition before
building. It observes actual prerendered root-layout HTML, runs the loader against
an inert document, verifies its generated URL and the noscript iframe, and executes
the compiled client SMS predicate/verification/event fragment with synthetic data.
Initial success, failure, unverified result, verified redisplay, phone change,
duplicate suppression, event-only payload and disabled storage/dataLayer isolation
are checked. It also executes the compiled server GTM gate with poisoned Runtime
ENV. This offline fragment verification is not full Browser Acceptance.

The verifier deliberately accepts only the reviewed Source bytes and known compiler
shape. A future analytics, layout, SMS or Next config change requires renewed review
and focused validation; missing functions or unknown compiled shapes fail closed.
The global error document bypasses the app layout and is checked as GTM disabled.

The Build observation `.next/gtm-build-observation.json` records `gtm_id`,
`gtm_enabled`, Build ID and hashes of inspected compiled/rendered files. It is
included in the existing regular-file checksums. Artifact Manifest fields
`gtm_id`, `gtm_enabled` and `gtm_observation_sha256` derive from this observation.
The same behavior and byte observations are recomputed before tar creation, after
package extraction and after exact Artifact-ID/digest-checked download. Manifest,
Build ID, observation digest and file hashes must agree at every stage. Explicit
disabled verification requires `disabled`, a null ID and false enabled state;
missing/invalid expected IDs and mismatched metadata are rejected.

Local validation uses only `GTM-TEST0001` and unset builds, with no container
requests. Tar/extract/independent-copy tests verify transport integrity; an actual
GitHub Artifact-ID re-download and native ARM64 production smoke remain checks of
the later separately authorized formal Workflow run. No formal Artifact is created
or dispatched by this Draft task.

For a later Authority PR, obtain exact Source approval and formal OLD Test Human
Acceptance first, retain immutable alpha.46 Artifact12586773046 / Client / Testkit,
and retain Platform Runtime Source `3592fcdc8e43467c3dd67d2677ec52b7d328eb77`.
Keep all current checksums, Required Checks, Security, Node22.22.3, pnpm10.12.1,
the three exact Next16.4.2 guards, ARM64, Artifact ID/digest/hash and Build ID
checks. Updating the Authority must explicitly supersede its current GTM exclusion;
neither this Workflow SHA nor a later main SHA is the application Runtime Source.
Formal Build/Dispatch and NEW Production Activation require separate Human GO.

The remainder of this document is the historical PR186 Source handoff. Its
PR175/alpha.45 Authority description was current at that change's base; the
PR179/alpha.46 Authority described above is current for this Workflow task.

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
- The existing Auth and LINE Identity scanners rejected the patch's storage use.
  Their authentication/session storage bans and existing checks remain in force.
  Only the exact SHA-256-pinned contents of this non-authentication marker helper
  and its two focused tests are recognized as reviewed analytics storage. Any
  edits require renewed review and digest updates. Sixteen focused boundary tests reject added
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

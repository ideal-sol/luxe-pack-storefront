# SITE-GTM-20261026 — GTM Source / Production handoff

## GTM v1.3 — 決済完了の追加（Human承認 2026-11-06）

この追記はv1.3の正式追加仕様。登録完了の3キーは維持する。
v1.2以降のHuman決定により、OLD Test／PreviewはGTM OFFを継続し、
`NEXT_PUBLIC_GTM_ID` を設定しない。実ブラウザでの発火確認も行わない。
受け入れはSource、自動テスト、実コンパイル済みBuildのオフライン検証を根拠とする。
以下に残す旧文書のPreview計測確認・受け入れ要求は、このGTM変更には適用しない。
一般のGovernanceやProduction承認の方針は変更しない。今回もDraft PR #226まで。

`purchase_complete` は `/points/purchase/thanks?pid=` の完了画面で、既存の
認証済みPayment APIを利用するPolling結果が `ready`、正式なPaymentのstatusが
`succeeded` の時だけ送信する。URLのpidや決済会社のリダイレクト結果は成立根拠に
しない。クレジットカード・NetRideCash・Paidy等の手段を問わない。

| キー | 意味 |
| --- | --- |
| `event` | `purchase_complete` |
| `user_id` | ログイン中セッションの会員UUID（加工しない） |
| `user_email` | 下記の共通正規化とSHA-256による小文字16進数64桁。欠落・失敗時はキーを省略 |
| `revenue` | Platformの `payment.amount.amount`。実際に支払った税込みの円整数。コイン付与量、ボーナス、残高を含めない |
| `transaction_id` | Platformから取得した正式な `payment.id`（決済UUID）。URLから転記しない |

会員UUID、決済UUID、JPYの正の安全な整数額が不正・欠落ならイベントを送信しない。
未確定、処理中、失敗、取消、期限切れ、API取得失敗、権限エラー、遅延状態では送信しない。
既存APIの認可を利用し、他ユーザーの決済を取得する新しい手段は追加しない。
処理中から成功になった時に送信する。登録完了は初回SMS成功が根拠であり、
登録イベントにrevenueやtransaction_idを載せることはない。

メールは登録完了と同じ処理を共用する：NFKC → 前後の空白・タブ・改行除去 →
小文字 → UTF-8 → Web Crypto SHA-256 → 小文字16進数64桁。
生メール、電話番号、氏名、住所、OTPは送信しない。ハッシュメールも匿名情報ではない。
属性はすべて1回のpushにまとめ、ハッシュ処理・計測失敗が完了画面、ウォレット再取得、
Polling、購入履歴への遷移を待たせない。計測失敗で決済を再実行しない。

同一決済IDの処理中実行をメモリ上で抑止し、push成功後だけ短い決済ID由来の
localStorageマーカーを保存する。メール・メールハッシュ・生UUIDは保存しない。
Storage拒否時も同じ表示中の送信済みIDをメモリ上で抑止する。保存可能なら
再読込・再訪問でも送信済みマーカーで抑止する。別ブラウザ、別端末、Storage消去後、
複数タブの原子的な一意性や短いマーカーの衝突がないことは保証しない。
完了前に画面を閉じた等、完了画面で成功を確認しない決済は計測されない可能性がある。
広告計測件数はPlatformの正式な決済件数と一致する保証はない。

既存コンテナ `GTM-5DQRPNN2` を継続し、追加コンテナは作らない。
正式Production Workflowは引き続きmainのbuild-authority検証を使うため、
更新済み検証のmain反映と将来の正式Source／Build承認は別途必要。
今回のSource追加はMerge・正式Artifact Dispatch・Runtime反映を承認するものではない。
Humanがプライバシーポリシー／外部送信の公表、代理店共有、既存コンテナのタグ設定・
公開、本番反映後の実ブラウザ確認を担当する。

## GTM-REG-20261106 — 登録完了属性（Human承認 2026-11-06）

以下は従来の「イベント名のみ・会員IDを送信しない」仕様を更新する。
後続に残す過去のSource / Build Authorityと承認履歴は変更しない。

代理店向けイベントは `registration_complete`。初回SMS認証が成功した時だけ、
1回の `dataLayer.push` に次のキーをまとめる。

| キー | 内容 |
| --- | --- |
| `event` | `registration_complete` |
| `user_id` | セッションの会員UUID（管理画面の会員ID）。加工しない。欠落時はイベント自体を送信しない |
| `user_email` | セッションのメールを正規化しSHA-256にした小文字16進数64桁。欠落・空白のみ・Crypto失敗時はキーを省略 |

正規化はUnicode NFKC → 前後の半角・全角空白、タブ、改行除去 → 小文字化 →
UTF-8 → Web Crypto `SHA-256` → 小文字16進数の順。Gmailのドット除去等は行わない。
生メール、電話番号、氏名、住所、OTP等は送信しない。
ハッシュメールも完全匿名情報ではなく、匿名化済みとは扱わない。

ハッシュ処理は非同期。SMS成功、画面表示、事前登録完了コールバックを待たせない。
認証失敗、認証済み画面の再表示、電話番号変更では発火しない。
処理中はメモリ上で同一会員の重複実行を抑止し、push成功後のみ従来の会員ID由来の
短いマーカーをlocalStorageへ記録する。UUID、生メール、メールハッシュは保存しない。
localStorage拒否時はbest effort。別端末・別ブラウザ・保存消去後の一意性や、
複数タブ間の原子的な一意性は保証しない。

コンテナは既存の `GTM-5DQRPNN2` を継続し、追加しない。
無効・未設定BuildではdataLayerとlocalStorageにアクセスしない。
OLD TestはGTM OFFを維持し、`NEXT_PUBLIC_GTM_ID` を設定しない。

今回の承認はSource実装と1つのDraft PRまで。Merge、Runtime反映、正式Production
Artifact Dispatchは未承認。正式Workflowはmainの `build-authority` の検証スクリプトを
使用するため、このPRのスクリプトがmainへ反映される前に正式Buildへ使用できない。
Source・テスト・検証・文書は同じPRでレビューし、独立したローカルBuildで検証する。
Production Source Authority、Manifest Authority、承認済みArtifactは更新しない。
Human側でプライバシーポリシー（外部送信を含む）を更新し、代理店への招待・共有、
既存コンテナのタグ設定と公開、今後のSource Merge／Runtimeの承認を行う。

## GTM-SOURCE-AUTH-20261027 — Formal Human Source GO

Human has issued formal Source GO for PR191 to approve Application Runtime Source
PR186 `2be4169fd847d18d8de0f5bacc1b4a4d7c416b05`, tree
`81a65d46638dbf2c832c6f5b263424096e0328de`, and authorizes final validation,
Ready and Canonical Squash Merge. The Authority description now begins
`Human-approved exact Runtime Source:` and records `Formal Human Source GO RECEIVED`.
The existing authorization implementation is unchanged. It continues to reject
unapproved wording, mismatched Source/PR/Tree/checks and an incorrect protected main.
`activation_authorized=false` remains; Source approval does not grant Activation.

Base / merged PR189 Workflow is `9702793ec7fdad4332e634b230dc6661ff176655`.
That Workflow SHA, the Authority commit and latest main are not substitute
Application Sources. Only the exact PR186 Source above is approved for use by a
future separately authorized formal Production Build. This task does not execute
Artifact Dispatch/Build, NEW Production Stage/Runtime switch or GTM publishing.

Human reports `OLDTEST_PR186_GTM_DISABLED_FINAL_ACCEPTANCE_PASS` for exact
Source2be4169 / Next16.4.2 / Contract2.0.0-alpha.46 / GTM OFF. Technical PASS and
Human Browser5/5 cover only the five formal handoff items. Real SMS success/failure,
phone-number change, verified redisplay and GTM ON measurement remain subsequent
Production Acceptance items. No new Runtime acceptance is performed in this task.

All immutable alpha.46 Artifact12586773046 / Client / Testkit / OpenAPI pins and
checksums, Platform Runtime `3592fcdc8e43467c3dd67d2677ec52b7d328eb77` and Platform
Authority `0372d25ea61a4e6f15485568819f8f1029443b73` are retained. Workflow,
application Source, dependencies/vendor, Security and authorization code are unchanged.
Existing Production Artifacts and rollback assets remain untouched.

Before formal Artifact operations, obtain separate explicit Human Dispatch/Build GO
bound to exact PR186 Source, the then-approved protected-main Build Control/Authority
identity and required public Build inputs. Revalidate existing Source/Contract/checks
without substituting latest main for application Source. After an authorized Build,
verify actual GTM bytes/Manifest, ARM64, exact toolchain, Artifact ID/digest/hashes,
Build ID, package and exact-ID re-download. Stage/Activation and remaining Production
Acceptance retain their separate Human gates. This task stops after Authority Merge.

The sections below are historical Source/Workflow preparation records. PR189 is
merged and the five-item OLD Test PASS is reported above; earlier Draft-only
permissions, missing-report statements and PR179 Authority references describe
those prior stages and do not override this formal Source GO.

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

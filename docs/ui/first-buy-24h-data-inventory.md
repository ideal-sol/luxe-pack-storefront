# 初回コイン購入24時間 UI — Phase 1 / 2

Scope: Layout First / Contract Later. 提供割合 PR #137 と10桁表示は別Task。
Platform・Contract・Artifact pin・通常購入処理は変更しない。
この表は完成UIの表示依存であり、API schema、endpoint、adoption planではない。

## Source / comparison

正本 `oripoke-first-buy-24h.zip` をRepository外へ展開し、bundleの
`8fbb9a7612727631f12f6a67d64a27e4f2d10038` を参照した。
`first-buy-offer.tsx` のDOM、`first-buy-home.tsx` のdialog、
`first-buy-offer.css` の全納品区間とresponsive補正を再利用。
画像は比較PNGであり、追加するruntime画像はない。既存ブランド画像・fontを利用。
正本のAPI adapter、timer hook、deadline計算、商品eligibility判定、
表示済み記録、境界check許可の追加は採用しない。

比較対象: TOP active/guest 1280/390、コイン一覧 active/guest 1280/390、
expiredのpoints_off_1280、popup 1280/390、active_scrolled_1280。
urgent画像も確認したが、残り時間からurgentを決める処理は今回の対象外。
正本はコイン詳細に新しい24時間用DOM/CSSを追加していない。
確認用詳細は既存の見出し・購入内容summaryのCSSを使い、購入buttonを無効にする。
新しい時計・discount heroを詳細に追加しない。

## Review URLs and sample isolation

Preview専用のserver flag `STOREFRONT_FIRST_BUY_LAYOUT_PREVIEW=1` と、明示的な
`first_buy=active|expired|unauthenticated` が揃う場合だけサンプルを表示する。
通常buildではflagを設定しない。queryだけではサンプルを有効化できない。

- TOP: `/?first_buy=active`（expired / unauthenticatedも同じquery）
- 一覧: `/points?first_buy=active`（3状態を選択可）
- Popup: `/?first_buy=active&popup=1`
- 読取専用詳細: `/design/first-buy/purchase/500?first_buy=active`
- 詳細の500は固定サンプル識別子。実際のPlatform商品IDではない。

TOP / 一覧 / 詳細の確認欄から3状態を切り替えられる。価格・残高・時計はサンプルと明記。
割引CTAは確認用詳細だけに進み、PaymentClientProviderや購入formをmountしない。
詳細はflag無効時、状態不正時、商品サンプル不在時に404。
ポップアップは明示的な確認URLのみ。close / later / backdrop / Esc / CTAで閉じる。
表示済み状態はmount内のみで、reloadや別端末の扱いは実装しない。

## State presentation

| Presentation state | TOP | 一覧 | 確認用詳細 |
| --- | --- | --- | --- |
| active | 固定帯＋hero、明示指定時のみpopup | hero＋初回tab選択＋strip＋7割引カード | 初回ラベル・割引価格、購入無効 |
| expired | 通常TOP、offerなし | 通常tab・通常カード、初回tabは空 | 通常価格・終了案内、購入無効 |
| unauthenticated | guest hero・登録CTA、時計なし | 残高--・guest hero・通常tab、時計なし | 通常価格・loginリンク、購入無効 |

activeの全時計は `残り 23:41:12`。時間経過で表示・state・商品を変えない。
expiredはfixtureで選ぶ表示名であり、Storefrontが期限を確認した結果ではない。

## Inventory conventions

TypeはUI入力の候補。既存項目名を記載した行は既存Contractを参照するだけ。
「固定」はUI copy / image / route / local interactionで、追加Contract Dataは不要。
Sharedの「共通」はヘッダー・フッター等の既存shellで共用。
全ての対象UI要素を以下に列挙し、既存TOPの領域も依存を記録する。

## Shared shell (TOP / 一覧 / 詳細)

| UI Element | Required Data | Type | State dependency | Shared with another screen? | Reason |
| --- | --- | --- | --- | --- | --- |
| ロゴ・サイト名 | 既存APP_NAME、既存brand assets | string / static image | 全state | 共通 | 既存のブランド表示 |
| PC主navigation / mobile navigation | 固定link label / route、現在path | static / string | 全state | 共通 | ページ移動・現在位置 |
| header login/register/mypage/logout | 既存Session状態 | existing Session union | 実Sessionによる。fixtureと独立 | 共通 | 既存auth navigationを維持 |
| header残高 | 既存wallet.total_points | number | 既存authenticated時 | 共通 | 実Sessionの残高。fixtureで上書きしない |
| sticky header / progress line | scroll位置・viewport幅 | local number | 全state | 共通 | 見た目だけ。期間判定には使わない |
| footerブランド・案内 | 既存APP_NAME、静的copy / links | string / static | 全state | 共通 | 既存footer |
| footer「サイトについて」 | 既存footer pagesのslug/title/order | existing collection | 全state | 共通 | 公開navigation |
| レイアウト確認欄・3状態links | 選択したpresentation state / 現在path | local union / string | fixture時のみ | TOP / 一覧 / 詳細 | sampleの明示。新規business data不要 |

## TOP

| UI Element | Required Data | Type | State dependency | Shared with another screen? | Reason |
| --- | --- | --- | --- | --- | --- |
| 固定帯の限定札 | 固定copy | static string | active | 一覧 | 初回限定を伝える |
| 固定帯「最大90%OFF」 | heroと共通の最大割引率表示 | number | active | 一覧 / hero / popup | 同じoffer訴求 |
| 固定帯の残り時間 | 共通countdown表示値 | HH:mm:ss string | active | 一覧 / hero / popup | 23:41:12を表示。時計ロジックなし |
| 固定帯CTA「コインを見る」 | 一覧route | static route | active、PC表示 | 一覧 | 一覧へ移動。商品ID不要 |
| Home hero・brand装飾 | 既存static copy / assets / 登録route | static | 全state | 既存TOP | offer直前の既存レイアウト |
| offer heroのribbon・初回限定札 | 固定copy | static string | active / unauthenticated | 一覧 / popup | 限定訴求。guestで色・copyを変更 |
| offer hero見出し | stateで選ぶ固定copy | static string | active / unauthenticated | 一覧 / popup | activeとguestの説明 |
| offer hero最大割引率 | hero商品の割引率表示 | number | active / unauthenticated | 一覧 / popup | 最大%OFFの数字 |
| offer heroコイン数 | hero商品のgrant.total_points | number | active / unauthenticated | 一覧 / popup / 詳細 | 商品説明とCTA |
| offer hero通常価格・取消線 | hero商品の比較用通常価格 | number / JPY | active / unauthenticated | 一覧 / popup | 二重価格の根拠が必要。サンプルは固定500円 |
| offer hero割引価格 | hero商品のprice.amount | number / JPY | active / unauthenticated | 一覧 / popup / 詳細 | 50円表示 |
| offer hero時・分・秒の箱 | 共通countdown表示値の3区分 | HH:mm:ss string → display parts | active | 一覧 / popup | 1つの値で足りる。3つのContract項目不要 |
| offer hero購入CTA | 共通hero価格・コイン数、一覧route | numbers / static route | active | popup | TOPは一覧に進むため商品ID不要 |
| guest登録CTA | `/register` | static route | unauthenticated | 一覧 | 会員登録への案内 |
| heroの回数・税込・期限注記 | 正本copy | static string | active / unauthenticated | 一覧 / popup | 同じ注意文。開始条件copyは後続Human/Platform確認 |
| expired時のoffer非表示 | authoritative offer表示分類の候補 | presentation union | expired | 一覧 | 隠すには分類1つで足り、registration date不要 |
| Popupの同一hero | 上記heroデータ | same presentation inputs | active＋明示popup | TOP / 一覧 | 同じカードを再利用 |
| Popupのoverlay / close / later / Esc | mount内open state・focus | local boolean / element | popup表示時 | TOPのみ | dismissとfocus制御。user ID・表示済みflag不要 |
| 注目の企画・carousel | 既存banners画像/link/順序 | existing collection | 全state | 既存TOP | 今回未変更 |
| login bonus feed | 既存login Gacha一覧/presentation | existing collection | 既存Session | 既存TOP | 今回未変更、初回コインの分類から独立 |
| ガチャcategory / tag / sort / count | 既存categories/tags/gachas/meta、local選択 | existing collection / local union | 全state | ガチャ一覧 | 今回未変更 |
| ガチャcards | 既存summaryの画像/タイトル/コイン/残数/labels | existing GachaSummary | 全state | ガチャ一覧 | 今回未変更 |
| guide・assist・装飾画像 | 既存static copy / assets / links | static | 全state | 既存TOP | 新規offerデータ不要 |
| お知らせ | 既存noticesタイトル/日付/要約/重要度/ID | existing collection | 全state | お知らせ一覧 | 今回未変更 |
| 各既存領域のloading/error/empty/retry | 既存read結果・problem・local retry | existing state union | 既存API結果 | 対応する既存画面 | offer fixtureと独立 |

## コイン一覧

| UI Element | Required Data | Type | State dependency | Shared with another screen? | Reason |
| --- | --- | --- | --- | --- | --- |
| COINS / コイン購入・背景 | 固定copy / 既存CSS | static | 全state | 既存一覧 | 既存見出し |
| 固定帯4要素 | TOP固定帯と同一 | same inputs | active | TOP | state、最大率、clock、routeを共有 |
| 残高value | 既存wallet.total_points | number | authenticated表示候補 | header / mypage | fixtureは1000、guestは-- |
| guest残高案内 | 既存Session分類 / 固定copy | existing union / static | unauthenticated | 既存一覧 | 数値を表示しない説明 |
| 7日内失効欄 | 既存wallet.expiring_within_7_days | existing array | authenticated表示候補 | 既存一覧 | offer期限とは別のコイン残高情報 |
| 残高下hero全要素 | TOPのheroと同一 | same inputs | active / unauthenticated | TOP / popup | copy、価格、coin、clockを共用 |
| hero購入CTA | hero商品ID・価格・coin | string / numbers | active | 割引商品card / 詳細 | 一覧から選んだ商品の詳細へ進む |
| PRODUCT CATEGORY / 商品カテゴリー | 固定copy | static string | 全state | 既存一覧 | 説明見出し |
| すべてのユーザーtab | 固定copy・local category | static / local union | 全state | 既存一覧 | 通常商品一覧に切替 |
| 初回tabラベル / 初期選択 | offer表示分類・local category | union | activeは24時間限定、他は既存ラベル | TOPのoffer分類 | eligibilityを計算せず明示stateを描画 |
| Tab keyboard/focus/panel | local選択・refs | local union / element | 全state | 既存一覧interaction | API項目不要 |
| COIN PRODUCTS / コイン商品 | 固定copy | static string | 全state | 既存一覧 | 一覧見出し |
| 一覧直前の細いclock / 説明 | 共通countdown表示値・固定copy | HH:mm:ss string / static | activeかつ初回tab | TOP / hero / popup | heroが画面外でも確認できる |
| 割引cardの「450円おトク」 | 比較価格と販売価格の差額表示 | number | activeかつ初回tab | heroの比較価格 | 今回固定。比較価格根拠が必要 |
| 割引cardコイン数 | 商品grant.total_points | number | activeかつ初回tab | hero / 詳細 | 獲得数の表示 |
| 割引card通常取消価格 | 商品ごとの比較用通常価格 | number / JPY | activeかつ初回tab | hero | 実販売価格の根拠が必要 |
| 割引card24時間限定・回数・税込 | 固定copy | static string | activeかつ初回tab | hero / popup | 同じoffer文言 |
| 割引card価格button | 商品price.amount・商品ID | number / string | activeかつ初回tab | hero / 詳細 | 金額表示と詳細navigation。今回はsample routeのみ |
| 通常card badge/title/販売状態 | 既存product.audience.label / title / sale_state | existing fields | 通常tab、guest初回tab | 既存詳細 | 通常presentationを維持 |
| 通常card獲得数/価格 | 既存grant.total_points / price.amount | numbers | 通常tab | 詳細 | サンプルは固定通常商品 |
| 通常card詳細link | 既存product.id | string | 通常tab | 詳細 | 正式接続時の詳細navigation |
| guest購入案内・login CTA | 既存CTA / ineligible_reason、`/login` | existing union / static route | unauthenticated | 既存詳細 | 正本の「ログインして確認」を再利用。購入判定はしない |
| expired初回tabの空表示 | 明示stateと空sample collection | union / array | expiredかつ初回tab | 既存一覧empty | 期限を計算して商品を除去しない |
| 一覧の実read loading/error/empty | 既存collection / problem / read state | existing union | fixtureなしの既存画面 | 既存一覧 | 正常なread処理を変更しない |

## コイン詳細（正本の既存summaryを使う確認補助）

| UI Element | Required Data | Type | State dependency | Shared with another screen? | Reason |
| --- | --- | --- | --- | --- | --- |
| 一覧へ戻る | 一覧route、選択したfixture state | static route / local union | 全state | 一覧 | sampleのまま戻る |
| 商品見出し | 商品title / 獲得coin | string / number | 全state | 一覧 | 既存詳細classを再利用 |
| 初回／通常label | offer表示分類・商品audience | union / label | active / 他state | 一覧 | sample選択による表示 |
| SUMMARY / 購入内容 | 固定copy | static | 全state | 既存詳細 | 既存summary |
| 支払金額 | 選択商品の価格 | number / JPY | activeはsample割引、他はsample通常 | 一覧 / hero | sample価格を表示、実商品価格を上書きしない |
| 獲得coin・合計coin | 選択商品のgrant表示 | number | 全state | 一覧 | sampleはbonusなし。既存paymentの計算を変更しない |
| expired説明 | 固定copy・明示fixture state | static / union | expired | 一覧 | 終了状態の確認 |
| login link | `/login` | static route | unauthenticated | 共通header | 既存loginへのnavigation |
| 購入button（無効） | 固定disabled値・確認用copy | local boolean / static | 全state | 確認詳細のみ | 購入・card・3DS・決済methodのdataを要求しない |
| 正式詳細の条件・支払method・card・errors | 既存PointProduct / Payment Contract | existing fields | 通常実詳細の既存Platform結果 | 既存購入flow | 本Task未変更。fixtureは既存formをmountしない |
| 詳細の24時間clock | NONE | — | 全state | — | 正本に詳細専用clockなし。追加dataを要求しない |

## Minimal Contract Data Candidate

完成UIで不足する最小候補は次の3項目群。型名・配置・endpointは未確定。
既存Clientの応答を拡張したりadapterを作成したりしていない。

1. **Platform-authoritative offer presentation classification**: 1つのenum。
   active / unavailable / unauthenticatedを区別できれば今回の表示差を表現できる。
   expired fixtureはunavailable表示の見本。expired / consumed / other ineligibleを
   別々に受け取る理由は完成したoffer UIにはない。
2. **active時のcountdown表示値**: 1つの`HH:mm:ss`表示文字列で今のUIは足りる。
   hero / fixed bar / strip / popupで共用。今回は固定`23:41:12`。
   将来の正式timerが秒数・期限・Platform基準時刻を必要とするかは次Phaseで決める。
3. **比較通常価格の正当な根拠**: 二重価格を表示する各割引商品に対応する通常販売価格。
   既存通常商品との対応がPlatformにより保証されるなら新規価格値は不要。
   保証できないなら比較価格のnumberを1つ返す案、または既存通常商品IDによる対応案。
   両方を要求しない。根拠未確定の実商品に取消価格を表示してはいけない。

既存データを再利用する候補: 商品ID、title、grant.total_points、price.amount/currency、
audience、sale状態、既存CTA、wallet、既存Session。
最大割引率・おトク額・hero商品の訴求は同じ価格pairから表示上の算術で表せるため、
別々の追加フィールドを必須としない。今回その算術も採用せず数字を固定している。
対象商品の返却・購入可能性・開始条件・購入による消費はPlatformの判断領域。

追加の`eligible` / `authenticated` booleanはoffer分類と重複するため要求しない。
既存Sessionはheader / 通常購入で既に利用するが、offer判定の代用にはしない。
`expires_at` / `as_of` / `remaining_seconds`を全て必須とする根拠は今回の固定UIにはない。
user ID、登録日時、メール認証日時、表示済みflag、expiry cacheも今回不要。
Popupの自動表示・会員単位の1回制御は次Phaseの別判断。現在のdialog操作はlocalだけ。

## Missing capability record / next Human decisions

この文書を初回offer presentationのPlatform Change Request記録として扱う。
Backend未実装。新しいendpoint・response shape・generated Client methodは未作成。
HumanがSource / Browserを確認してから、次Phaseのtimer方式、開始条件copy、
通常価格との対応、hero選定、popupの自動表示条件を決める。
本Taskの表示fixtureを正式API型または購入条件へ採用してはいけない。

```text
Storefront-owned 24h eligibility logic: NONE
Date.now eligibility: NONE
Local 24h persistence: NONE
Platform changes: NONE
Contract changes: NONE
Human Source / Browser Review: READY (Human acceptance pending)
```

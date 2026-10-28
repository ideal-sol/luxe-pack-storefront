import Link from "next/link";

/**
 * はじめての方へ（デザイン 10_はじめての方へ.html、2026-10-28）。
 * Platform の値は使わない固定表示。表記はサイト全体のコインに合わせる。
 * 文言は利用規約・特定商取引法に基づく表示（2026-10-27 改定）と一致させること。
 * 連携ログイン（Google・LINE）はオープン時に表示しないため、会員登録はメールアドレスの案内だけにしている。
 */

const steps = [
  { title: "会員登録", body: "メールアドレスで登録し、携帯電話番号のSMS認証を行います。ご利用には年齢の確認をいただきます。" },
  { title: "コイン購入", body: "購入画面で商品の内容を確認し、案内に沿って購入します。" },
  { title: "ガチャを引く", body: "企画の内容と利用条件を確認して引きます。結果はその場で画面に出ます。" },
  { title: "景品を受け取る", body: "景品ごとに、発送依頼かコイン交換をお選びいただけます。" },
] as const;

const coinRows = [
  { label: "定価", body: <><b>1コイン＝1円</b>です。コインのご購入も、ガチャの単価も、このレートで表示しています。</> },
  { label: "割引販売のとき", body: <>お支払金額に対してボーナスコインを付与します。お支払金額と付与されるコイン数は、各商品のご購入ページに表示します。</> },
  { label: "有効期限", body: <>有償コインに有効期限はありません。無償コインの有効期限は、付与時の案内をご確認ください。</> },
  { label: "払い戻し", body: <>法令上必要な場合等を除き、購入済みコインの払い戻し・返金・換金はいたしません。</> },
  { label: "お支払い方法", body: <>ご利用いただける決済手段は、コイン購入画面に表示します。</> },
] as const;

const receiveRows = [
  { label: "発送を申し込む", body: <>マイページの獲得アイテムから発送を申し込みます。配送のお手続きを行った日より<b>原則7日以内</b>に発送します。追跡番号つきでお送りします。送料は原則として当社負担です。</> },
  { label: "コインに交換する", body: <>発送せず、その場でコインに交換できます。交換できる景品かどうかは、景品ごとの表示をご確認ください。</> },
  { label: "届いたものが違ったら", body: <>品違い・汚損・破損があった場合は、お引渡し時にそれが存在したことを確認できたときにかぎり、交換またはコインの返還で対応します。お問い合わせからご連絡ください。</> },
] as const;

const conditionRows = [
  { label: "未成年の方", body: <>18歳未満の方はご登録いただけません。</> },
  { label: "キャンセル・返金", body: <>キャンセル・返金の条件は、利用規約および特定商取引法に基づく表示をご確認ください。</> },
  { label: "退会", body: <>マイページの「アカウント」から退会手続きへお進みください。費用はかかりません。<b>退会の時点で保有しているコインと、受け取りのお手続きがお済みでない景品は消滅します。</b>受け取りをご希望の景品がある場合は、退会の前に発送のお申し込みをお済ませください。</> },
] as const;

function GuideTable({ rows }: { readonly rows: readonly { readonly label: string; readonly body: React.ReactNode }[] }) {
  return (
    <dl className="beginners-table">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.body}</dd>
        </div>
      ))}
    </dl>
  );
}

export const beginnersGuideContent = { conditionRows, coinRows, receiveRows, steps } as const;

export function BeginnersGuide() {
  return (
    <div className="beginners">
      <section aria-labelledby="beginners-about" className="beginners-panel">
        <h2 id="beginners-about">オリポケは、ポケモンカード専門のオンラインオリパです</h2>
        <p className="beginners-panel__lead">サイト内のコインでガチャをお引きいただき、当たったカードは発送かコイン交換をお選びいただけます。</p>
        <ol className="beginners-steps">
          {steps.map((step, index) => (
            <li key={step.title}>
              <b>STEP {index + 1}　{step.title}</b>
              <span>{step.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="beginners-coin" className="beginners-panel">
        <h2 id="beginners-coin">コインについて</h2>
        <p className="beginners-panel__lead">ガチャは、サイト内のコインでお引きいただきます。</p>
        <GuideTable rows={coinRows} />
      </section>

      <section aria-labelledby="beginners-contents" className="beginners-panel">
        <h2 id="beginners-contents">引く前に、中身を全部お見せします</h2>
        <p className="beginners-panel__lead">何が何本入っているかを、引く前にご確認いただけます。</p>
        <ul className="beginners-cards">
          <li><b>景品ラインナップ</b><span>その企画に入っている景品を、ガチャの詳細画面にすべて掲載しています。</span></li>
          <li><b>提供割合</b><span>どの景品がどれだけ入っているかを、企画ごとに公開しています。詳細画面の「提供割合を見る」からご覧ください。</span></li>
        </ul>
        <p className="beginners-panel__note">※ 上位賞の残り本数は公開しておりません。公開しているのは残り口数です。</p>
      </section>

      <section aria-labelledby="beginners-receive" className="beginners-panel">
        <h2 id="beginners-receive">当たったカードの受け取り方</h2>
        <p className="beginners-panel__lead">景品ごとに、ご利用いただける方法が異なります。</p>
        <GuideTable rows={receiveRows} />
      </section>

      <section aria-labelledby="beginners-conditions" className="beginners-panel">
        <h2 id="beginners-conditions">ご利用の条件</h2>
        <GuideTable rows={conditionRows} />
      </section>

      <section aria-labelledby="beginners-help" className="beginners-panel">
        <h2 id="beginners-help">お困りのときは</h2>
        <p className="beginners-panel__lead">お問い合わせフォームからご相談ください。</p>
        <p className="beginners-panel__note">
          ご利用方法・景品・発送・お支払いについてのご質問は、<Link href="/contact">お問い合わせフォーム</Link>で承ります。<br />
          くわしい条件は、<Link href="/pages/terms">利用規約</Link>および<Link href="/pages/tradelaw">特定商取引法に基づく表示</Link>をご確認ください。
        </p>
        <p className="beginners-panel__action"><Link className="button button--accent" href="/gachas">ガチャ一覧を見る</Link></p>
      </section>
    </div>
  );
}

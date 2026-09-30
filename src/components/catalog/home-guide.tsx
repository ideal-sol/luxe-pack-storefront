import Link from "next/link";
import { HomeSectionHeading } from "./home-section-heading";

/**
 * トップ固定の案内区画（デザイン top.html の「ポイントの購入」「ご利用の流れ」「安心してご利用いただくために」）。
 * Platform の値は使わない固定表示。表記はサイト全体に合わせて「ポイント」を「コイン」にしている。
 * 文言を変えるときはこのファイルの定数だけを編集する（決済手段・安心の約束は運用実態と一致させること）。
 */

const coinPlans = [
  { amount: "商品一覧", price: "購入画面で商品を選択", memo: "販売中のコイン商品をご確認ください", best: false },
  { amount: "価格・枚数", price: "商品ごとに内容を確認", memo: "価格と付与コイン数は購入画面に表示します", best: true },
  { amount: "購入手続き", price: "内容を確認して購入へ", memo: "利用できる決済手段は購入画面でご確認ください", best: false },
] as const;

const paymentMethods = [
  { icon: "card", name: "決済手段", note: "購入画面で確認" },
  { icon: "bank", name: "お支払い金額", note: "商品ごとの価格を確認" },
  { icon: "store", name: "付与コイン", note: "商品の内容を確認" },
  { icon: "phone", name: "購入手続き", note: "画面の案内に沿って操作" },
] as const;

const paymentNotes = [
  "※ 販売中の商品・価格・付与コイン数・利用できる決済手段は、コイン購入画面でご確認ください。",
  "※ コインの取り扱いは、利用規約および特定商取引法に基づく表記をご確認ください。",
] as const;

const flowSteps = [
  { image: "/brand/sd_orika_egao.webp", width: 153, height: 208, title: "会員登録", body: "メールアドレスとパスワードで登録します。" },
  { image: "/brand/sd_pokezou_makasero.webp", width: 133, height: 200, title: "コイン購入", body: "購入画面で商品の内容を確認し、案内に沿って購入します。" },
  { image: "/brand/sd_fukumaru_osuwari.webp", width: 215, height: 200, title: "ガチャを引く", body: "企画の内容と利用条件を確認して引きます。獲得した景品は結果画面で確認できます。" },
  { image: "/brand/sd_orika_wink.webp", width: 138, height: 216, title: "景品を受け取る", body: "景品ごとに利用可能な方法で発送依頼・コイン交換を行います。" },
] as const;

const assurances = [
  { icon: "ship", title: "発送について", body: "発送の条件や手続きは、景品の案内とご利用ガイドをご確認ください。景品ごとに利用可能な方法が異なります。" },
  { icon: "minor", title: "ご利用条件について", body: "ご利用前に利用規約をご確認ください。各企画の利用条件は、ガチャの詳細画面でご確認いただけます。" },
  { icon: "help", title: "お困りのときは", body: "ご利用方法はご利用ガイドをご確認ください。届いた景品やお手続きについてご不明な点は、お問い合わせからご相談ください。" },
] as const;

export const homeGuideContent = { assurances, coinPlans, flowSteps, paymentMethods, paymentNotes } as const;

function PaymentIcon({ kind }: { readonly kind: (typeof paymentMethods)[number]["icon"] }) {
  return (
    <svg aria-hidden="true" className="home-guide__pay-icon" height="32" viewBox="0 0 46 32" width="46">
      {kind === "card" && (
        <>
          <rect fill="#00BEB1" height="30" rx="4" width="44" x="1" y="1" /><rect fill="#173A3C" height="7" width="44" x="1" y="8" />
          <rect fill="#FFCA37" height="4" rx="2" width="16" x="6" y="21" /><rect fill="#fff" height="4" rx="2" width="13" x="26" y="21" />
        </>
      )}
      {kind === "bank" && (
        <>
          <path d="M23 3 L43 12 H3 Z" fill="#00BEB1" /><rect fill="#31A3AC" height="3" width="40" x="3" y="14" />
          <rect fill="#00BEB1" height="9" width="4" x="8" y="18" /><rect fill="#00BEB1" height="9" width="4" x="16" y="18" />
          <rect fill="#00BEB1" height="9" width="4" x="26" y="18" /><rect fill="#00BEB1" height="9" width="4" x="34" y="18" />
          <rect fill="#FFCA37" height="3" width="40" x="3" y="28" />
        </>
      )}
      {kind === "store" && (
        <>
          <rect fill="#00BEB1" height="22" rx="2" width="38" x="4" y="9" /><rect fill="#FFCA37" height="7" width="38" x="4" y="2" />
          <rect fill="#fff" height="3" width="26" x="10" y="16" /><rect fill="#fff" height="3" width="17" x="10" y="22" />
        </>
      )}
      {kind === "phone" && (
        <>
          <rect fill="#00BEB1" height="30" rx="3" width="18" x="14" y="1" /><rect fill="#fff" height="17" width="12" x="17" y="6" />
          <circle cx="23" cy="27" fill="#FFCA37" r="2" />
        </>
      )}
    </svg>
  );
}

function AssuranceIcon({ kind }: { readonly kind: (typeof assurances)[number]["icon"] }) {
  return (
    <svg aria-hidden="true" className="home-guide__safe-icon" height="36" viewBox="0 0 100 100" width="36">
      {kind === "ship" && (
        <>
          <rect fill="#00BEB1" height="100" rx="14" width="100" /><rect fill="#fff" height="32" rx="4" width="44" x="18" y="34" />
          <path d="M62 44 h12 l8 10 v12 h-20 Z" fill="#FFCA37" />
          <circle cx="32" cy="70" fill="#173A3C" r="7" /><circle cx="70" cy="70" fill="#173A3C" r="7" />
        </>
      )}
      {kind === "minor" && (
        <>
          <rect fill="#31A3AC" height="100" rx="14" width="100" /><circle cx="50" cy="38" fill="#fff" r="15" />
          <path d="M22 78 a28 22 0 0 1 56 0 Z" fill="#fff" /><rect fill="#FFCA37" height="9" rx="4" width="30" x="58" y="56" />
        </>
      )}
      {kind === "help" && (
        <>
          <rect fill="#00BEB1" height="100" rx="14" width="100" /><path d="M22 28 h56 v34 h-34 l-14 14 v-14 h-8 Z" fill="#fff" />
          <rect fill="#FFCA37" height="7" rx="3" width="32" x="34" y="40" />
        </>
      )}
    </svg>
  );
}

export function HomeGuide() {
  return (
    <>
      <section aria-labelledby="home-guide-coins" className="home-guide home-guide--buy">
        <div className="page-container">
          <HomeSectionHeading
            id="home-guide-coins"
            lead="ガチャは、サイト内のコインでお引きいただきます。販売中の商品はコイン購入画面でご確認ください。"
            title="コインの購入"
            watermark="COIN"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
            <img alt="" aria-hidden="true" className="home-peek home-peek--guide" height={216} src="/brand/sd_orika_wink.webp" width={138} />
          </HomeSectionHeading>
          <ul className="home-guide__plans">
            {coinPlans.map((plan) => (
              <li className={plan.best ? "home-guide__plan home-guide__plan--best" : "home-guide__plan"} key={plan.amount}>
                <p className="home-guide__plan-amount">{plan.amount}</p>
                <p className="home-guide__plan-price">{plan.price}</p>
                <p className="home-guide__plan-memo">{plan.memo}</p>
                <Link className="home-guide__plan-buy" href="/points">コイン購入画面へ</Link>
              </li>
            ))}
          </ul>
          <div className="home-guide__paybox">
            <h3>購入前の確認事項</h3>
            <ul className="home-guide__pays">
              {paymentMethods.map((method) => (
                <li key={method.name}>
                  <PaymentIcon kind={method.icon} />
                  <strong>{method.name}</strong>
                  <span>{method.note}</span>
                </li>
              ))}
            </ul>
            <div className="home-guide__paynote">
              {paymentNotes.map((note) => <p key={note}>{note}</p>)}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="home-guide-flow" className="home-guide home-guide--flow">
        <div className="page-container">
          <HomeSectionHeading id="home-guide-flow" lead="会員登録から、カードがお手元に届くまで。" title="ご利用の流れ" watermark="FLOW" />
          <ol className="home-guide__flow">
            {flowSteps.map((step, index) => (
              <li key={step.title}>
                <span className="home-guide__step-no">STEP {index + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
                <img alt="" aria-hidden="true" height={step.height} src={step.image} width={step.width} />
                <span aria-hidden="true" className="home-guide__pedestal" />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="home-guide-safe" className="home-guide home-guide--safe">
        <div className="page-container">
          <HomeSectionHeading id="home-guide-safe" title="安心してご利用いただくために" watermark="SAFETY" />
          <ul className="home-guide__safes">
            {assurances.map((item) => (
              <li key={item.title}>
                <AssuranceIcon kind={item.icon} />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

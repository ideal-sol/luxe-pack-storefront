import { brandAssetUrl } from "@/lib/brand-assets";
import { HomeSectionHeading } from "./home-section-heading";

/**
 * トップ固定の案内区画（デザイン 00_トップ.html の「ご利用の流れ」「安心してご利用いただくために」）。
 * 2026-10-28 のデザインで「コインの購入」の節は削除した。
 * Platform の値は使わない固定表示。表記はサイト全体のコインに合わせる。
 * 文言を変えるときはこのファイルの定数だけを編集する（決済手段・安心の約束は運用実態と一致させること）。
 */

const flowSteps = [
  // STEP 1・2 のキャラクターはデザイン 2026-10-28 の差し替え（sd_orika_touroku / sd_pokezou_coin）。
  // STEP 3・4（sd_fukumaru_gacha / sd_orika_uketoru）は Brand 素材の追加後に差し替える。
  { image: brandAssetUrl("sd_orika_touroku.webp"), width: 126, height: 208, title: "会員登録", body: "メールアドレスで登録し、携帯電話番号のSMS認証を行います。ご利用には年齢の確認をいただきます。" },
  { image: brandAssetUrl("sd_pokezou_coin.webp"), width: 173, height: 200, title: "コイン購入", body: "購入画面で商品の内容を確認し、案内に沿って購入します。" },
  { image: brandAssetUrl("sd_fukumaru_osuwari.webp"), width: 215, height: 200, title: "ガチャを引く", body: "企画の内容と利用条件を確認して引きます。獲得した景品は結果画面で確認できます。" },
  { image: brandAssetUrl("sd_orika_wink.webp"), width: 138, height: 216, title: "景品を受け取る", body: "景品ごとに利用可能な方法で発送依頼・コイン交換を行います。" },
] as const;

const assurances = [
  { icon: "ship", title: "発送について", body: "発送の条件や手続きは、景品の案内とご利用ガイドをご確認ください。景品ごとに利用可能な方法が異なります。" },
  { icon: "minor", title: "ご利用条件について", body: "ご利用前に利用規約をご確認ください。各企画の利用条件は、ガチャの詳細画面でご確認いただけます。" },
  { icon: "help", title: "お困りのときは", body: "ご利用方法はご利用ガイドをご確認ください。届いた景品やお手続きについてご不明な点は、お問い合わせからご相談ください。" },
] as const;

export const homeGuideContent = { assurances, flowSteps } as const;

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
      <section aria-labelledby="home-guide-flow" className="home-guide home-guide--flow">
        <div className="page-container">
          <HomeSectionHeading id="home-guide-flow" lead="会員登録から、カードがお手元に届くまで。" title="ご利用の流れ" watermark="FLOW" />
          <ol className="home-guide__flow">
            {flowSteps.map((step, index) => (
              <li key={step.title}>
                {index > 0 && <span aria-hidden="true" className="home-guide__flow-arrow">▶</span>}
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

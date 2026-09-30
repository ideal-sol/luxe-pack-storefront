import Link from "next/link";
import { informationNavigation } from "@/lib/routes/navigation";

/**
 * トップページのメインビジュアル。
 * 表示文言はサイト固有のブランド表現であり、販売・抽選・コインの判断は含まない。
 * リボンの訴求文は運用実態と一致するものだけを掲載する（変更時は運用担当と確認する）。
 */
export const homeHeroRibbonMessages = [
  "ポケモンカード専門",
  "排出内容と割合を企画ごとに公開",
  "景品に応じて発送・コイン交換",
  "発送は追跡番号つき",
] as const;

export function HomeHero() {
  return (
    <section aria-labelledby="home-hero-title" className="home-hero">
      <div aria-hidden="true" className="home-hero__dots" />
      <div className="page-container home-hero__inner">
        <div className="home-hero__character home-hero__character--left" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
          <img alt="" height={444} src="/brand/pokezou_sd.webp" width={310} />
        </div>
        <div className="home-hero__copy">
          <p className="home-hero__badge">ポケモンカード専門のオンラインオリパ</p>
          <h1 id="home-hero-title">
            最高の<span>一枚</span>を、<br />あなたに！
          </h1>
          <p className="home-hero__lead">
            獲得した景品は、景品ごとに利用可能な方法で
            <br className="home-hero__lead-break" />
            発送依頼またはコイン交換を行えます。
          </p>
          <div className="home-hero__actions">
            <Link className="home-hero__cta home-hero__cta--primary" href="/gachas">ガチャ一覧を見る</Link>
            <Link className="home-hero__cta home-hero__cta--secondary" href={informationNavigation[0].href}>はじめての方へ</Link>
          </div>
        </div>
        <div className="home-hero__character home-hero__character--right" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
          <img alt="" className="home-hero__dog" height={268} src="/brand/fukumaru_hashiru.webp" width={328} />
          {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
          <img alt="" height={424} src="/brand/orika_sd.webp" width={271} />
        </div>
      </div>
      <div className="home-hero__ribbon">
        <ul aria-label="サービスの特長" className="home-hero__ribbon-track">
          {homeHeroRibbonMessages.map((message) => <li key={message}>{message}</li>)}
          {homeHeroRibbonMessages.map((message) => <li aria-hidden="true" key={`repeat-${message}`}>{message}</li>)}
        </ul>
      </div>
    </section>
  );
}

import Link from "next/link";
import { informationNavigation } from "@/lib/routes/navigation";
import { HomeHeroCards } from "./home-hero-cards";
import { HomeLiveBand, homeLiveBandEnabled, type HomeLiveBandProps } from "./home-live-band";

/** ライブ感の帯に渡す実データ。現状は取得元がないため null（帯は表示しない）。 */
const liveBandData: HomeLiveBandProps | null = null;

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

/** 背景を上っていく光の粒（位置・大きさ・色・周期はデザインの top.html と同じ値）。 */
const heroSparks = [
  [14, 0, 6, "y", 6.5, 0], [75, 17, 8, "w", 8, 0.7], [39, 34, 10, "w", 7.2, 1.4], [3, 51, 7, "y", 9, 2.1],
  [64, 8, 12, "w", 6, 2.8], [28, 25, 9, "w", 10.5, 3.5], [89, 42, 6, "y", 6.5, 4.2], [53, 59, 8, "w", 8, 4.9],
  [17, 16, 10, "w", 7.2, 5.6], [78, 33, 7, "y", 9, 0.3], [42, 50, 12, "w", 6, 1], [6, 7, 9, "w", 10.5, 1.7],
  [67, 24, 6, "y", 6.5, 2.4], [31, 41, 8, "w", 8, 3.1], [92, 58, 10, "w", 7.2, 3.8], [56, 15, 7, "y", 9, 4.5],
] as const;

/** 手前を上っていくぼけ玉（デザイン top.html の作り込みと同じ規則の固定値）。 */
const heroBokeh = Array.from({ length: 14 }, (_, index) => ({
  delay: index * 0.9,
  duration: 9 + (index % 6) * 2.4,
  left: (index * 7.3) % 98,
  size: 6 + ((index * 7) % 22),
}));

export function HomeHero() {
  return (
    <section aria-labelledby="home-hero-title" className="home-hero">
      <div aria-hidden="true" className="home-hero__layer home-hero__rays" />
      <div aria-hidden="true" className="home-hero__layer home-hero__holo"><i /><i /></div>
      <div aria-hidden="true" className="home-hero__dots" />
      <div aria-hidden="true" className="home-hero__lightsweep"><i /></div>
      <div aria-hidden="true" className="home-hero__sparks">
        {heroSparks.map(([left, bottom, size, tone, duration, delay]) => (
          <i
            className={tone === "y" ? "home-hero__spark home-hero__spark--yellow" : "home-hero__spark"}
            key={`${left}-${bottom}`}
            style={{ animationDelay: `${delay}s`, animationDuration: `${duration}s`, bottom: `${bottom}%`, height: size, left: `${left}%`, width: size }}
          />
        ))}
      </div>
      <HomeHeroCards />
      <div aria-hidden="true" className="home-hero__layer home-hero__bokeh">
        {heroBokeh.map((item) => (
          <i
            key={item.left}
            style={{ animationDelay: `${item.delay}s`, animationDuration: `${item.duration}s`, height: item.size, left: `${item.left}%`, width: item.size }}
          />
        ))}
      </div>
      <div className="page-container home-hero__inner">
        <div className="home-hero__character home-hero__character--left" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
          <img alt="" className="home-hero__pokezou" height={444} src="/brand/pokezou_sd.webp" width={310} />
        </div>
        <div className="home-hero__copy">
          <p className="home-hero__badge"><b aria-hidden="true" />ポケモンカード専門のオンラインオリパ<b aria-hidden="true" /></p>
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
          <img alt="" className="home-hero__dog home-hero__fukumaru" height={268} src="/brand/fukumaru_hashiru.webp" width={328} />
          {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
          <img alt="" className="home-hero__orika" height={424} src="/brand/orika_sd.webp" width={255} />
        </div>
      </div>
      <svg aria-hidden="true" className="home-hero__wave" preserveAspectRatio="none" viewBox="0 0 1440 46">
        <path d="M0,26 C160,46 300,4 470,14 C640,24 760,48 920,38 C1080,28 1250,2 1440,16 L1440,46 L0,46 Z" />
      </svg>
      {/* ライブ感の帯（閲覧人数・本日の開封・完売企画の当選報告）：実データの仕組みができるまで非表示。
          表示する場合は homeLiveBandEnabled を true にし、HomeLiveBand に実データを渡す（架空の数字は出さない）。 */}
      {homeLiveBandEnabled && liveBandData ? <HomeLiveBand {...liveBandData} /> : null}
      <div className="home-hero__ribbon">
        <ul aria-label="サービスの特長" className="home-hero__ribbon-track">
          {homeHeroRibbonMessages.map((message) => <li key={message}>{message}</li>)}
          {homeHeroRibbonMessages.map((message) => <li aria-hidden="true" key={`repeat-${message}`}>{message}</li>)}
        </ul>
      </div>
    </section>
  );
}

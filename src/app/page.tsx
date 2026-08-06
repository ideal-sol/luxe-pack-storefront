import Link from "next/link";
import { AppIcon } from "@/components/common/app-icon";
import { PageContainer } from "@/components/layout/page-container";
import { primaryNavigation } from "@/lib/routes/navigation";

const assurances = [
  { index: "01", title: "Curated", text: "ラインナップはPlatform接続後に表示します。" },
  { index: "02", title: "Transparent", text: "必要な情報をわかりやすく届ける設計です。" },
  { index: "03", title: "Connected", text: "取引判断はPlatformの正規契約へ委ねます。" },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <PageContainer className="hero__grid">
          <div className="hero__copy">
            <p className="hero__eyebrow"><span /> A NEW PACK EXPERIENCE</p>
            <h1>余白まで、<br /><em>特別</em>に。</h1>
            <p className="hero__lead">Luxe Packらしい体験を届けるためのStorefrontを準備しています。</p>
            <div className="hero__actions">
              <Link className="button button--accent" href="/gachas">パックを見る</Link>
              <Link className="button button--line" href="/register">新規登録</Link>
            </div>
          </div>
          <div aria-label="交換可能なメインビジュアル" className="hero-art" role="img">
            <div className="hero-art__halo" />
            <div className="hero-art__pack hero-art__pack--back"><span>LP</span></div>
            <div className="hero-art__pack hero-art__pack--front"><small>THE COLLECTION</small><strong>LUXE<br />PACK</strong><span>01 / FOUNDATION</span></div>
            <p>PLACEHOLDER VISUAL</p>
          </div>
        </PageContainer>
      </section>

      <section className="quick-links">
        <PageContainer>
          <div className="quick-links__grid">
            {primaryNavigation.map((item, index) => (
              <Link href={item.href} key={item.href}>
                <span className="quick-links__index">0{index + 1}</span>
                <AppIcon name={item.icon} size={26} />
                <strong>{item.label}</strong>
                <span className="quick-links__arrow">↗</span>
              </Link>
            ))}
          </div>
        </PageContainer>
      </section>

      <section className="foundation-section">
        <PageContainer>
          <header className="section-heading">
            <div><p>OUR STANDARD</p><h2>共通体験の基準</h2></div>
            <span>SITE-001</span>
          </header>
          <div className="assurance-grid">
            {assurances.map((item) => (
              <article key={item.index}>
                <span>{item.index}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>

      <section className="notice-preview">
        <PageContainer className="notice-preview__inner">
          <div><p>INFORMATION</p><h2>お知らせ</h2></div>
          <p>お知らせはPlatform接続後に表示します。</p>
          <Link href="/notices">一覧を見る <span>→</span></Link>
        </PageContainer>
      </section>
    </>
  );
}

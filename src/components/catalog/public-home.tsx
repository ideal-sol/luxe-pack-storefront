"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  ContentBanner,
  ContentNoticeSummary,
  GachaCategory,
  GachaSummary,
  PlatformProblemPresentation,
} from "@/lib/platform";
import { presentPlatformProblem } from "@/lib/platform";
import { PageContainer } from "@/components/layout/page-container";
import { usePublicClient } from "./public-client-provider";
import { CatalogAsset } from "./catalog-asset";
import { CatalogLoading, CatalogMessage } from "./catalog-message";
import { GachaCard } from "./gacha-card";

interface HomeData {
  readonly banners: readonly ContentBanner[];
  readonly categories: readonly GachaCategory[];
  readonly gachas: readonly GachaSummary[];
  readonly notices: readonly ContentNoticeSummary[];
}

type HomeState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly data: HomeData };

function safeBannerHref(value: string | null) {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function Banner({ banner, priority }: { readonly banner: ContentBanner; readonly priority: boolean }) {
  const href = safeBannerHref(banner.link_url);
  const content = (
    <>
      <CatalogAsset alt={banner.asset.alt_text ?? banner.title} fallbackLabel="BANNER PREPARING" priority={priority} src={banner.asset.path} />
      <div className="home-banner__caption"><span>FEATURED</span><strong>{banner.title}</strong></div>
    </>
  );
  return href ? <a className="home-banner" href={href}>{content}</a> : <div className="home-banner">{content}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeZone: "Asia/Tokyo" }).format(new Date(value));
}

export function PublicHome() {
  const { client, configurationAvailable } = usePublicClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<HomeState>(
    configurationAvailable ? { status: "loading" } : { status: "configuration-unavailable" },
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    void Promise.all([
      client.listBanners(),
      client.listGachaCategories(),
      client.listGachas({ limit: 6 }),
      client.listNotices({ limit: 3 }),
    ]).then(([banners, categories, gachas, notices]) => {
      if (!active) return;
      setState({
        status: "ready",
        data: {
          banners: banners.data.items,
          categories: categories.data.data,
          gachas: gachas.data.data,
          notices: notices.data.items,
        },
      });
    }).catch((error: unknown) => {
      if (active) setState({ status: "error", problem: presentPlatformProblem(error) });
    });
    return () => { active = false; };
  }, [client, requestKey]);

  function retry() {
    setState({ status: "loading" });
    setRequestKey((current) => current + 1);
  }

  if (state.status === "loading") {
    return <PageContainer className="public-home-state"><CatalogLoading label="トップページを読み込み中" /></PageContainer>;
  }
  if (state.status === "configuration-unavailable") {
    return <PageContainer className="public-home-state"><CatalogMessage description="この環境では公開Catalog接続が設定されていません。" eyebrow="CONFIGURATION" title="公開情報を表示できません" /></PageContainer>;
  }
  if (state.status === "error") {
    return <PageContainer className="public-home-state"><CatalogMessage action={retry} description={state.problem.message} eyebrow="ERROR" title="公開情報を取得できませんでした" tone="error" /></PageContainer>;
  }

  const { banners, categories, gachas, notices } = state.data;
  return (
    <>
      <section className="home-banners" aria-label="メインビジュアル">
        <PageContainer className="home-content">
          {banners.length > 0 ? (
            <div className="home-banners__rail">{banners.map((banner, index) => <Banner banner={banner} key={banner.id} priority={index === 0} />)}</div>
          ) : (
            <CatalogMessage description="現在表示できるバナーはありません。" eyebrow="EMPTY" title="新しいご案内を準備中です" />
          )}
        </PageContainer>
      </section>

      <section className="home-categories">
        <PageContainer className="home-content">
          <header className="catalog-section-heading"><div><p>FIND YOUR PACK</p><h2>カテゴリーから探す</h2></div><Link href="/gachas">すべて見る <span>→</span></Link></header>
          {categories.length > 0 ? (
            <nav aria-label="ガチャカテゴリー" className="category-links">
              {categories.map((category) => <Link href={`/gachas?category=${encodeURIComponent(category.slug)}`} key={category.id}><span>{category.name}</span><small>{category.description ?? "PACK CATEGORY"}</small></Link>)}
            </nav>
          ) : <CatalogMessage description="利用できるカテゴリーはありません。" eyebrow="EMPTY" title="カテゴリーを準備中です" />}
        </PageContainer>
      </section>

      <section className="home-gachas">
        <PageContainer className="home-content">
          <header className="catalog-section-heading"><div><p>NOW AVAILABLE</p><h2>販売中ガチャ</h2></div><Link href="/gachas">もっと見る <span>→</span></Link></header>
          {gachas.length > 0 ? (
            <div className="gacha-grid">{gachas.map((gacha, index) => <GachaCard gacha={gacha} key={gacha.id} priority={index < 2} />)}</div>
          ) : <CatalogMessage description="現在表示できるガチャはありません。" eyebrow="EMPTY" title="ラインナップを準備中です" />}
        </PageContainer>
      </section>

      <section className="home-notices">
        <PageContainer>
          <header className="catalog-section-heading"><div><p>INFORMATION</p><h2>お知らせ</h2></div><Link href="/notices">一覧を見る <span>→</span></Link></header>
          {notices.length > 0 ? (
            <div className="notice-list">{notices.map((notice) => <Link href={`/notices/${notice.id}`} key={notice.id}><time dateTime={notice.publish_start_at}>{formatDate(notice.publish_start_at)}</time>{notice.is_important && <span>重要</span>}<strong>{notice.title}</strong><p>{notice.summary ?? "--"}</p></Link>)}</div>
          ) : <CatalogMessage description="現在表示できるお知らせはありません。" eyebrow="EMPTY" title="お知らせはありません" />}
        </PageContainer>
      </section>
    </>
  );
}

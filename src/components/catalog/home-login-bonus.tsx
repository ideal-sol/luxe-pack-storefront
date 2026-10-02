"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { presentPlatformProblem, type LoginGachaSummary, type PlatformProblemPresentation } from "@/lib/platform";
import { usePublicClient } from "./public-client-provider";
import { CatalogAsset } from "./catalog-asset";
import { CatalogLoading, CatalogMessage } from "./catalog-message";
import { PageContainer } from "@/components/layout/page-container";
import { HomeSectionHeading } from "./home-section-heading";

/**
 * トップ「無料・ログインボーナス」（デザイン 2026-09-30 top.html の section.bonus）。
 * 表示のみの部品。抽選・回数制限・対象者の判定は Platform 側で実装し、この部品では行わない。
 * HomeLoginBonusFeed が Public login list の結果を既存カードへ渡す。
 */
export interface HomeLoginBonusItem {
  /** 例：「毎日1回ログボ」 */
  readonly title: string;
  /** 例：「（毎日タダ引き）」。見出しの2行目に出す */
  readonly subtitle?: string;
  readonly imageSrc?: string;
  readonly imageAlt: string;
  /** 1回あたりのコイン数。0 は「無料」と表示する */
  readonly pricePoints: number;
  /** バーの左の文言（例：ログインボーナス企画） */
  readonly conditionLabel: string;
  /** バーの右の文言（例：1日1回） */
  readonly limitLabel: string;
  /** 詳細画面への遷移先。未設定のあいだはボタンを押せない表示にする */
  readonly href?: string;
}

/** 既存TOPのログインボーナス区画の表示設定。 */
export const homeLoginBonusEnabled = true;

/**
 * デザインの表示例（画像・文言はデザインのまま。「pt」表記はコインに置き換え）。
 * Public list が空の場合に限り、既存の準備中表示として使用する。
 */
export const homeLoginBonusSampleItems: readonly HomeLoginBonusItem[] = [
  {
    conditionLabel: "ログインボーナス企画",
    imageAlt: "ログボでアド確（全口510コイン確定）",
    imageSrc: "/brand/login-bonus/logbo-adokaku.webp",
    limitLabel: "口数の上限なし",
    pricePoints: 500,
    subtitle: "（全口510コイン確定）",
    title: "ログボでアド確",
  },
  {
    conditionLabel: "ログインボーナス企画",
    imageAlt: "毎日1回ログボ（毎日タダ引き）",
    imageSrc: "/brand/login-bonus/logbo-mainichi.webp",
    limitLabel: "1日1回",
    pricePoints: 0,
    subtitle: "（毎日タダ引き）",
    title: "毎日1回ログボ",
  },
  {
    conditionLabel: "新規登録の方かぎり",
    imageAlt: "初回無料（新規登録者向け）",
    imageSrc: "/brand/login-bonus/logbo-shokai.webp",
    limitLabel: "お一人さま1回",
    pricePoints: 0,
    subtitle: "（新規登録者向け）",
    title: "初回無料",
  },
];

const coins = new Intl.NumberFormat("ja-JP");

function LoginBonusCard({ item }: { readonly item: HomeLoginBonusItem }) {
  const free = item.pricePoints <= 0;
  const image = item.href
    ? <CatalogAsset alt={item.imageAlt} fallbackLabel="画像を準備中" src={item.imageSrc ?? null} />
    : (
      // eslint-disable-next-line @next/next/no-img-element -- Existing static placeholder artwork.
      <img alt={item.imageAlt} height={497} loading="lazy" src={item.imageSrc} width={760} />
    );
  const heading = (
    <>
      {item.title}
      {item.subtitle && <><br />{item.subtitle}</>}
    </>
  );
  return (
    <article className="gacha-card gacha-card--bonus" data-price-tier="mid">
      {item.href ? (
        <Link aria-label={`${item.title}の詳細を見る`} className="gacha-card__image" href={item.href}>
          {image}
          <span aria-hidden="true" className="gacha-card__streak" />
        </Link>
      ) : (
        <div className="gacha-card__image">
          {image}
          <span aria-hidden="true" className="gacha-card__streak" />
        </div>
      )}
      <div className="gacha-card__body">
        <h3>{item.href ? <Link href={item.href}>{heading}</Link> : heading}</h3>
        <div className="gacha-card__meta">
          <p aria-label={free ? "単価 無料" : `単価 ${item.pricePoints}コイン`}>
            <span>単価</span>
            <strong>{free ? "無料" : <>{coins.format(item.pricePoints)}<small>コイン</small></>}</strong>
          </p>
          <p aria-label="総口数 設定なし">
            <span>総口数</span>
            <strong aria-hidden="true">―</strong>
          </p>
        </div>
        <div className="gacha-card__limit">
          <span>{item.conditionLabel}</span>
          <span>{item.limitLabel}</span>
        </div>
        <div aria-hidden="true" className="gacha-card__progress gacha-card__progress--bonus">
          <span style={{ width: "100%" }} />
        </div>
        {item.href ? (
          <Link aria-hidden="true" className="gacha-card__cta" href={item.href} tabIndex={-1}>詳細を見る</Link>
        ) : (
          <span aria-disabled="true" className="gacha-card__cta gacha-card__cta--pending">準備中</span>
        )}
      </div>
    </article>
  );
}

type BonusState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly items: readonly LoginGachaSummary[] };

export function HomeLoginBonusFeed() {
  const { client } = usePublicClient();
  const [state, setState] = useState<BonusState>({ status: "loading" });
  const [requestKey, setRequestKey] = useState(0);
  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.listLoginGachas().then(({ data }) => {
      if (active) setState({ status: "ready", items: data.items });
    }).catch((error: unknown) => {
      if (active) setState({ status: "error", problem: presentPlatformProblem(error) });
    });
    return () => { active = false; };
  }, [client, requestKey]);
  const items: readonly HomeLoginBonusItem[] = state.status === "ready" && state.items.length > 0
    ? state.items.map((item) => ({
      title: item.title,
      ...(item.thumbnail?.media_type === "image" ? { imageSrc: item.thumbnail.path } : {}),
      imageAlt: item.thumbnail?.alt_text ?? item.title,
      pricePoints: item.gacha_type === "signup_once" ? 0 : item.price_points,
      conditionLabel: item.gacha_type === "signup_once" ? "新規登録限定" : "ログインボーナス企画",
      limitLabel: item.gacha_type === "signup_once" ? "1ユーザー1回" : "1日1回",
      href: `/login-gachas/${encodeURIComponent(item.id)}`,
    }))
    : homeLoginBonusSampleItems;
  return <HomeLoginBonus items={items} state={state} retry={() => { setState({ status: "loading" }); setRequestKey((key) => key + 1); }} />;
}

export function HomeLoginBonus({ items = homeLoginBonusSampleItems, state, retry }: {
  readonly items?: readonly HomeLoginBonusItem[];
  readonly state?: BonusState;
  readonly retry?: () => void;
}) {
  const empty = !state || state.status === "ready" && state.items.length === 0;
  return (
    <section aria-labelledby="home-bonus-heading" className="home-bonus">
      <PageContainer className="home-content">
        <HomeSectionHeading
          id="home-bonus-heading"
          lead={empty ? "ログインボーナス企画は準備中です。画像・条件は表示例で、現在はご利用いただけません。" : "毎日のログインや新規登録で参加できるガチャです。"}
          title="無料・ログインボーナス"
          watermark="FREE"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
          <img alt="" aria-hidden="true" className="home-peek home-peek--left" height={220} src="/brand/sd_pokezou_ooatari.webp" width={164} />
        </HomeSectionHeading>
        {state?.status === "loading" && <CatalogLoading label="ログインボーナスを読み込み中" />}
        {state?.status === "error" && <CatalogMessage {...(retry ? { action: retry } : {})} description={state.problem.message} eyebrow="ERROR" title="ログインボーナスを取得できませんでした" tone="error" />}
        {(!state || state.status === "ready") && <div className="gacha-grid gacha-grid--bonus">
          {items.map((item) => <LoginBonusCard item={item} key={item.href ?? item.title} />)}
        </div>}
      </PageContainer>
    </section>
  );
}

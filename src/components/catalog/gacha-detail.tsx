"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  GachaDetail,
  GachaPresentationState,
  PlatformProblemPresentation,
} from "@/lib/platform";
import { isPlatformNotFound, presentPlatformProblem } from "@/lib/platform";
import { CatalogAsset } from "./catalog-asset";
import { CatalogLoading, CatalogMessage } from "./catalog-message";
import { gachaSaleStateLabels } from "./gacha-presentation";
import { usePublicClient } from "./public-client-provider";
import { GachaDrawPanel } from "@/components/draw/gacha-draw-panel";

type DetailState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "not-found" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | {
      readonly status: "ready";
      readonly detail: GachaDetail;
      readonly presentation: GachaPresentationState;
    };

const number = new Intl.NumberFormat("ja-JP");
function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function remainingPercentage(detail: GachaDetail) {
  if (detail.total_count <= 0) return 0;
  return Math.min(100, Math.max(0, (detail.remaining_count / detail.total_count) * 100));
}
function PrizeSections({ detail }: { readonly detail: GachaDetail }) {
  const ranks = [...detail.ranks].sort((left, right) =>
    left.display_order - right.display_order || left.rank_id.localeCompare(right.rank_id));

  return (
    <section aria-labelledby="gacha-prizes" className="gacha-prizes">
      <header className="gacha-section-heading">
        <p>PRIZE LINEUP</p>
        <h2 id="gacha-prizes">景品ラインナップ</h2>
      </header>
      {ranks.length === 0 ? (
        <p className="gacha-detail__neutral">公開中の景品情報はありません。</p>
      ) : ranks.map((rank) => {
        const lineupImage = rank.lineup_image.media_type === "image" ? rank.lineup_image : null;
        return (
          <section aria-labelledby={`rank-${rank.rank_id}`} className="prize-rank" key={rank.rank_id}>
            <header>
              <h3 id={`rank-${rank.rank_id}`}>{rank.rank_name}</h3>
              {rank.show_total_stock === true && rank.total_stock !== null && (
                <p>設定総数 {number.format(rank.total_stock)}点</p>
              )}
            </header>
            <div className="prize-rank__lineup">
              <CatalogAsset
                alt={lineupImage?.alt_text ?? `${rank.rank_name}の景品ラインナップ`}
                fallbackLabel="LINEUP IMAGE"
                {...(lineupImage?.path ? { src: lineupImage.path } : {})}
              />
            </div>
          </section>
        );
      })}
    </section>
  );
}

function DetailContent({ detail, presentation }: { readonly detail: GachaDetail; readonly presentation: GachaPresentationState }) {
  const asset = detail.presentation_asset?.media_type === "image" ? detail.presentation_asset : null;
  const publishEnd = formatDateTime(detail.publish_end_at);
  return (
    <article className="gacha-detail">
      <nav aria-label="パンくず" className="gacha-detail__breadcrumb">
        <Link href="/">ホーム</Link><span aria-hidden="true">/</span><Link href="/gachas">ガチャ</Link><span aria-hidden="true">/</span><span aria-current="page">{detail.title}</span>
      </nav>
      <section className="gacha-detail__hero">
        <div className="gacha-detail__visual">
          <CatalogAsset alt={asset?.alt_text ?? detail.title} fallbackLabel="PACK IMAGE" priority {...(asset?.path ? { src: asset.path } : {})} />
        </div>
        <div className="gacha-detail__summary">
          <div className="gacha-detail__badges"><span>{gachaSaleStateLabels[presentation.sale_state]}</span><span>{detail.category.name}</span></div>
          <h1>{detail.title}</h1>
          <div className="gacha-detail__tags">{detail.tags.map((tag) => <span key={tag.id}>#{tag.name}</span>)}</div>
          <dl className="gacha-detail__facts">
            <div><dt>1回</dt><dd>{number.format(detail.price_points)} コイン</dd></div>
            <div><dt>残り口数</dt><dd>{number.format(detail.remaining_count)} / {number.format(detail.total_count)}</dd></div>
            <div><dt>販売開始</dt><dd>{formatDateTime(detail.publish_start_at)}</dd></div>
            {publishEnd && <div><dt>販売終了予定</dt><dd>{publishEnd}</dd></div>}
          </dl>
          <div aria-label={`残り${detail.remaining_count}口、全${detail.total_count}口`} className="gacha-progress" role="progressbar" aria-valuemax={detail.total_count} aria-valuemin={0} aria-valuenow={detail.remaining_count}>
            <span style={{ width: `${remainingPercentage(detail)}%` }} />
          </div>
        </div>
      </section>
      {detail.notices && (
        <details className="gacha-notices">
          <summary>注意事項・ご利用条件</summary>
          <p>{detail.notices}</p>
        </details>
      )}
      <PrizeSections detail={detail} />
      {detail.description && (
        <section aria-labelledby="gacha-description" className="gacha-description">
          <header className="gacha-section-heading">
            <p>ABOUT THIS GACHA</p>
            <h2 id="gacha-description">ガチャ説明</h2>
          </header>
          <p>{detail.description}</p>
        </section>
      )}
      <GachaDrawPanel detail={detail} presentation={presentation} />
    </article>
  );
}

export function GachaDetailView({ slug }: { readonly slug: string }) {
  const { client, configurationAvailable } = usePublicClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<DetailState>(
    configurationAvailable ? { status: "loading" } : { status: "configuration-unavailable" },
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.getGachaBySlug(slug)
      .then(async ({ data }) => {
        const presentation = await client.getGachaPresentation(data.data.id);
        if (active) setState({ detail: data.data, presentation: presentation.data.data, status: "ready" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState(isPlatformNotFound(error)
          ? { status: "not-found" }
          : { status: "error", problem: presentPlatformProblem(error) });
      });
    return () => { active = false; };
  }, [client, requestKey, slug]);

  function retry() {
    setState({ status: "loading" });
    setRequestKey((current) => current + 1);
  }

  if (state.status === "loading") return <CatalogLoading label="ガチャ詳細を読み込み中" />;
  if (state.status === "configuration-unavailable") {
    return <CatalogMessage description="現在、ガチャ詳細を表示できません" eyebrow="ERROR" title="ガチャ詳細を表示できません" tone="error" />;
  }
  if (state.status === "not-found") {
    return <CatalogMessage description="指定されたガチャは公開されていないか、見つかりません。" eyebrow="NOT FOUND" title="ガチャが見つかりません" />;
  }
  if (state.status === "error") {
    return <CatalogMessage action={retry} description={state.problem.message} eyebrow="ERROR" title="ガチャ詳細を取得できませんでした" tone="error" />;
  }
  return <DetailContent detail={state.detail} presentation={state.presentation} />;
}

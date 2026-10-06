"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GachaDetail, PlatformProblemPresentation } from "@/lib/platform";
import { isPlatformNotFound, presentPlatformProblem } from "@/lib/platform";
import { formatPpmAsPercent } from "@/lib/presentation/prize-rate";
import { gachaDetailRoute } from "@/lib/routes/navigation";
import { CatalogLoading, CatalogMessage } from "./catalog-message";
import { usePublicClient } from "./public-client-provider";

/*
 * 提供割合ページ（ガチャ詳細の「提供割合を見る」から開く）。
 * 表示のみ。割合は Platform が返した値（probability_stages の賞ごとの合計）をそのまま % 表記にし、
 * 封入数は Platform が公開している値（賞の合計・景品ごとの数）だけを出す。ここでは割合を計算しない。
 */

type PrizeRateState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "not-found" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly detail: GachaDetail };

type GachaRank = GachaDetail["ranks"][number];
type GachaPrize = NonNullable<GachaDetail["prizes"]>[number];

interface PrizeRateRow {
  readonly key: string;
  readonly name: string;
  readonly ppm: number;
  /** 賞の封入数の公開可否と景品の内訳を持つ Rank。最低保証・コイン還元の行には無い。 */
  readonly rank: GachaRank | null;
}

const number = new Intl.NumberFormat("ja-JP");

/** 現在の抽選に適用されている段階（Platform が is_current で示す）。 */
function currentStage(detail: GachaDetail) {
  return detail.probability_stages.find((stage) => stage.is_current) ?? null;
}

function prizeRateRows(detail: GachaDetail): readonly PrizeRateRow[] {
  const stage = currentStage(detail);
  if (!stage) return [];
  const rows: PrizeRateRow[] = stage.rank_probabilities.map((entry) => ({
    key: `rank-${entry.rank.id}`,
    name: entry.rank.name,
    ppm: entry.total_ppm,
    rank: detail.ranks.find((rank) => rank.rank_id === entry.rank.id) ?? null,
  }));
  const guarantee = stage.minimum_guarantee;
  if (guarantee.total_ppm > 0) {
    rows.push({
      key: "minimum-guarantee",
      name: guarantee.result_type === "prize" && guarantee.rank ? `${guarantee.rank.name}（最低保証）` : "コイン還元（最低保証）",
      ppm: guarantee.total_ppm,
      rank: null,
    });
  }
  if (stage.point_back_total_ppm > 0) {
    rows.push({ key: "point-back", name: "コイン還元", ppm: stage.point_back_total_ppm, rank: null });
  }
  return rows;
}

function RowCells({ row }: { readonly row: PrizeRateRow }) {
  const disclosed = row.rank?.show_total_stock === true && row.rank.total_stock != null;
  return (
    <>
      <span className="prize-rate__rank-name">{row.name}</span>
      <span className="prize-rate__count">
        <span className="prize-rate__sr">封入数</span>
        {disclosed ? <>{number.format(row.rank.total_stock ?? 0)}<small>口</small></> : <span aria-label="非公開">—</span>}
      </span>
      <span className="prize-rate__percent">
        <span className="prize-rate__sr">提供割合</span>
        {formatPpmAsPercent(row.ppm)}
      </span>
    </>
  );
}

function PrizeRateRowItem({ prizes, row }: { readonly prizes: readonly GachaPrize[]; readonly row: PrizeRateRow }) {
  // 景品ごとの内訳は、その賞の総数を公開している場合だけ開けるようにする（ガチャ詳細と同じ扱い）。
  const breakdown = row.rank?.show_total_stock === true
    ? prizes.filter((prize) => prize.rank_id === row.rank?.rank_id && prize.total_inventory != null)
    : [];
  if (breakdown.length === 0) {
    return <li className="prize-rate__row"><div className="prize-rate__cells"><RowCells row={row} /></div></li>;
  }
  return (
    <li className="prize-rate__row">
      <details>
        <summary className="prize-rate__cells"><RowCells row={row} /></summary>
        <ul aria-label={`${row.name}の内訳`} className="prize-rate__prizes">
          {breakdown.map((prize) => (
            <li key={prize.id}>
              <span>{prize.name}</span>
              <span>{number.format(prize.total_inventory)}<small>口</small></span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function PrizeRateContent({ detail }: { readonly detail: GachaDetail }) {
  const rows = prizeRateRows(detail);
  return (
    <article className="prize-rate">
      <Link className="prize-rate__back" href={gachaDetailRoute(detail.slug)}><span aria-hidden="true">←</span>ガチャ詳細へ戻る</Link>
      <h2 className="prize-rate__title">{detail.title}</h2>
      <dl className="prize-rate__total">
        <div><dt>総口数</dt><dd>{number.format(detail.total_count)}<small>口</small></dd></div>
      </dl>
      {rows.length === 0 ? (
        <p className="gacha-detail__neutral">公開中の提供割合の情報はありません。</p>
      ) : (
        <section aria-label="賞ごとの提供割合" className="prize-rate__table">
          <div aria-hidden="true" className="prize-rate__cells prize-rate__head">
            <span>賞</span><span>封入数（口）</span><span>提供割合</span>
          </div>
          <ul className="prize-rate__rows">
            {rows.map((row) => <PrizeRateRowItem key={row.key} prizes={detail.prizes ?? []} row={row} />)}
          </ul>
        </section>
      )}
      <ul className="prize-rate__notes">
        <li>表示している提供割合は、公開中の段階に設定された割合です。封入数は販売開始時点の総数で、購入時点の残り口数や当選確率とは異なります。</li>
        <li>表示している割合は、特定の賞の当選を保証するものではありません。</li>
        <li>提供割合は小数第4位まで表示しています。</li>
      </ul>
    </article>
  );
}

function PrizeRateRequest({ slug }: { readonly slug: string }) {
  const { client, configurationAvailable } = usePublicClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<PrizeRateState>(
    configurationAvailable ? { status: "loading" } : { status: "configuration-unavailable" },
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.getGachaBySlug(slug)
      .then(({ data }) => { if (active) setState({ detail: data.data, status: "ready" }); })
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

  if (state.status === "loading") return <CatalogLoading label="提供割合を読み込み中" />;
  if (state.status === "configuration-unavailable") {
    return <CatalogMessage description="現在、提供割合を表示できません" eyebrow="ERROR" title="提供割合を表示できません" tone="error" />;
  }
  if (state.status === "not-found") {
    return <CatalogMessage description="指定されたガチャは公開されていないか、見つかりません。" eyebrow="NOT FOUND" title="ガチャが見つかりません" />;
  }
  if (state.status === "error") {
    return <CatalogMessage action={retry} description={state.problem.message} eyebrow="ERROR" title="提供割合を取得できませんでした" tone="error" />;
  }
  return <PrizeRateContent detail={state.detail} />;
}

export function GachaPrizeRateView({ slug }: { readonly slug: string }) {
  return <PrizeRateRequest key={slug} slug={slug} />;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiProblemError } from "@oripa/storefront-client";
import { useSession } from "@/components/auth/session-provider";
import { CatalogAsset } from "@/components/catalog/catalog-asset";
import { LoadingState } from "@/components/common/loading-state";
import { LoginRequiredState } from "@/components/common/state-panel";
import { presentPlatformProblem, type DrawResponse, type PlatformProblemPresentation } from "@/lib/platform";
import { useDrawClient } from "./draw-client-provider";

type ResultState =
  | { readonly status: "loading" }
  | { readonly status: "not-found" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly result: DrawResponse };

const number = new Intl.NumberFormat("ja-JP");

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function ResultMessage({
  description,
  retry,
  title,
}: {
  readonly description: string;
  readonly retry?: () => void;
  readonly title: string;
}) {
  return (
    <section className="state-panel state-panel--error">
      <p className="state-panel__eyebrow">DRAW RESULT</p>
      <h1>{title}</h1>
      <p>{description}</p>
      {retry && <button className="button button--dark" onClick={retry} type="button">もう一度確認する</button>}
      <Link className="button button--ghost" href="/gachas">ガチャ一覧へ</Link>
    </section>
  );
}

function DrawResultContent({ result }: { readonly result: DrawResponse }) {
  return (
    <article className="draw-result">
      <header className="draw-result__header">
        <p>DRAW COMPLETED</p>
        <h1>抽選結果</h1>
        <span>{number.format(result.executed_count)}回の抽選が完了しました</span>
      </header>
      <dl className="draw-result__summary">
        <div><dt>抽選回数</dt><dd>{number.format(result.executed_count)}回</dd></div>
        <div><dt>消費ポイント</dt><dd>{number.format(result.point_cost_total)}pt</dd></div>
        <div><dt>ポイント還元</dt><dd>{number.format(result.point_back_total)}pt</dd></div>
        <div><dt>実行日時</dt><dd>{formatDateTime(result.created_at)}</dd></div>
      </dl>
      <section aria-labelledby="draw-prizes" className="draw-result__prizes">
        <div className="section-heading">
          <p>PRIZES</p>
          <h2 id="draw-prizes">獲得景品</h2>
        </div>
        {result.prize_counts.length === 0 ? (
          <p className="draw-result__empty">獲得景品はありません。Platformが確定したポイント還元をご確認ください。</p>
        ) : (
          <div className="draw-result__grid">
            {result.prize_counts.map(({ count, prize, rank }) => {
              const asset = prize.presentation_asset?.media_type === "image" ? prize.presentation_asset : null;
              return (
                <article className="draw-result-card" key={prize.id}>
                  <div className="draw-result-card__image">
                    <CatalogAsset alt={asset?.alt_text ?? prize.name} fallbackLabel="PRIZE IMAGE" {...(asset?.path ? { src: asset.path } : {})} />
                  </div>
                  <div>
                    <span>{rank.name}</span>
                    <h3>{prize.name}</h3>
                    <p>× {number.format(count)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <nav aria-label="抽選結果の次の操作" className="draw-result__actions">
        <Link className="button button--dark" href="/mypage/prizes">獲得アイテムを確認</Link>
        <Link className="button button--ghost" href="/gachas">ガチャ一覧へ</Link>
      </nav>
    </article>
  );
}

export function DrawResultView({ drawRequestId }: { readonly drawRequestId: string }) {
  const { state: session } = useSession();
  const { client, configurationAvailable } = useDrawClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<ResultState>({ status: "loading" });

  useEffect(() => {
    if (session.status !== "authenticated" || !client) return;
    let active = true;
    void client.getDrawRequest(drawRequestId)
      .then(({ data }) => { if (active) setState({ result: data, status: "ready" }); })
      .catch((error: unknown) => {
        if (!active) return;
        setState(error instanceof ApiProblemError && error.status === 404
          ? { status: "not-found" }
          : { problem: presentPlatformProblem(error), status: "error" });
      });
    return () => { active = false; };
  }, [client, drawRequestId, requestKey, session.status]);

  if (session.status === "loading") return <LoadingState />;
  if (session.status === "configuration-unavailable" || !configurationAvailable) {
    return <ResultMessage description="この環境ではPlatform接続が設定されていません。" title="抽選結果を表示できません" />;
  }
  if (session.status !== "authenticated") return <LoginRequiredState />;
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "not-found") {
    return <ResultMessage description="指定された抽選結果は見つかりません。" title="抽選結果が見つかりません" />;
  }
  if (state.status === "error") {
    return <ResultMessage description={state.problem.message} retry={() => {
      setState({ status: "loading" });
      setRequestKey((current) => current + 1);
    }} title="抽選結果を取得できませんでした" />;
  }
  return <DrawResultContent result={state.result} />;
}

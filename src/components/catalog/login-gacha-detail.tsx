"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthProblemError } from "@oripa/storefront-client";
import { useSession } from "@/components/auth/session-provider";
import { LoginGachaDrawPanel } from "@/components/draw/login-gacha-draw-panel";
import { isPlatformNotFound, presentPlatformProblem, type LoginGachaDetail, type PlatformProblemPresentation } from "@/lib/platform";
import { CatalogAsset } from "./catalog-asset";
import { CatalogLoading, CatalogMessage } from "./catalog-message";
import { RankLineupImage } from "./rank-lineup-image";
import { usePublicClient } from "./public-client-provider";

type DetailState =
  | { readonly status: "loading" | "redirecting" | "not-found" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly detail: LoginGachaDetail };

export function loginGachaLoginRoute(id: string) {
  return `/login?returnTo=${encodeURIComponent(`/login-gachas/${encodeURIComponent(id)}`)}`;
}

export function LoginGachaDetailView({ gachaId }: { readonly gachaId: string }) {
  const { state } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (state.status === "unauthenticated" || state.status === "session-expired") router.replace(loginGachaLoginRoute(gachaId));
  }, [gachaId, router, state.status]);
  if (state.status === "error" || state.status === "configuration-unavailable") {
    return <CatalogMessage description="セッションを確認できません。再度お試しください。" eyebrow="ERROR" title="認証情報を取得できませんでした" tone="error" />;
  }
  if (state.status !== "authenticated") return <CatalogLoading label="ログイン情報を確認中" />;
  // Session changes unmount all personal data and pending operations; there is no shared eligibility cache.
  return <AuthenticatedDetail gachaId={gachaId} key={`${state.session.user!.id}:${gachaId}`} />;
}

function AuthenticatedDetail({ gachaId }: { readonly gachaId: string }) {
  const { client } = usePublicClient();
  const router = useRouter();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [requestKey, setRequestKey] = useState(0);
  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.getLoginGacha(gachaId).then(({ data }) => {
      if (active) setState({ status: "ready", detail: data.data });
    }).catch((error: unknown) => {
      if (!active) return;
      if (isAuthProblemError(error, "AUTHENTICATION_REQUIRED") || isAuthProblemError(error, "SESSION_EXPIRED")) {
        setState({ status: "redirecting" });
        router.replace(loginGachaLoginRoute(gachaId));
      } else setState(isPlatformNotFound(error) ? { status: "not-found" } : { status: "error", problem: presentPlatformProblem(error) });
    });
    return () => { active = false; };
  }, [client, gachaId, requestKey, router]);
  if (!client) return <CatalogMessage description="現在、ガチャ詳細を表示できません" eyebrow="ERROR" title="ガチャ詳細を表示できません" tone="error" />;
  if (state.status === "error") return <CatalogMessage action={() => { setState({ status: "loading" }); setRequestKey((key) => key + 1); }} description={state.problem.message} eyebrow="ERROR" title="ガチャ詳細を取得できませんでした" tone="error" />;
  if (state.status === "not-found") return <CatalogMessage description="指定されたガチャは公開されていないか、見つかりません。" eyebrow="NOT FOUND" title="ガチャが見つかりません" />;
  if (state.status !== "ready") return <CatalogLoading label="ガチャ詳細を読み込み中" />;
  const detail = state.detail;
  const signup = detail.gacha_type === "signup_once";
  const thumbnail = detail.thumbnail?.media_type === "image" ? detail.thumbnail : null;
  return <article className="gacha-detail">
    <nav aria-label="パンくず" className="gacha-detail__breadcrumb"><Link href="/">ホーム</Link><span aria-hidden="true">/</span><span aria-current="page">{detail.title}</span></nav>
    <section className="gacha-detail__hero">
      <div className="gacha-detail__visual"><CatalogAsset alt={thumbnail?.alt_text ?? detail.title} fallbackLabel="PACK IMAGE" priority src={thumbnail?.path ?? null} /></div>
      <div className="gacha-detail__summary">
        <div className="gacha-detail__badges"><span>{signup ? "新規登録限定" : "ログインボーナス"}</span><span>{signup ? "1ユーザー1回" : "1日1回"}</span></div>
        <h1>{detail.title}</h1>
        <dl className="gacha-detail__facts"><div><dt>1回</dt><dd>{detail.price_points === 0 ? "無料" : `${new Intl.NumberFormat("ja-JP").format(detail.price_points)} コイン`}</dd></div></dl>
      </div>
    </section>
    {detail.notices && <details className="gacha-notices"><summary>注意事項・ご利用条件</summary><p>{detail.notices}</p></details>}
    <section aria-labelledby="gacha-prizes" className="gacha-prizes">
      <header className="gacha-section-heading"><p>PRIZE LINEUP</p><h2 id="gacha-prizes">景品ラインナップ</h2></header>
      {detail.ranks.map((rank) => <section aria-labelledby={`rank-${rank.id}`} className="prize-rank" key={rank.id}>
        <header><h3 aria-label={rank.name} id={`rank-${rank.id}`}><RankLineupImage image={rank.lineup_image} name={rank.name} /></h3></header>
        <div className="prize-rank__grid">{detail.prizes.filter((prize) => prize.rank_id === rank.id).map((prize) => <div aria-label={prize.name} className="prize-rank__prize" key={prize.id}><CatalogAsset alt={prize.asset?.alt_text ?? prize.name} fallbackLabel="PRIZE IMAGE" src={prize.asset?.media_type === "image" ? prize.asset.path : null} /></div>)}</div>
      </section>)}
    </section>
    {detail.description && <section aria-labelledby="gacha-description" className="gacha-description"><header className="gacha-section-heading"><p>ABOUT THIS GACHA</p><h2 id="gacha-description">ガチャ説明</h2></header><p>{detail.description}</p></section>}
    <LoginGachaDrawPanel detail={detail} />
  </article>;
}

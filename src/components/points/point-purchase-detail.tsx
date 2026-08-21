"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import {
  presentPlatformProblem,
  type PlatformProblemPresentation,
  type PointProduct,
  type PointProductCollection,
} from "@/lib/platform";
import { usePointClient } from "./point-client-provider";
import {
  LimitedBonusPresentation,
  pointProductIneligibleReasonLabels,
  pointProductNumber,
  pointProductSaleStateLabels,
  presentCoinTerminology,
} from "./point-purchase-page";

type DetailState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "session-error" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation; readonly productId: string; readonly sessionKey: string }
  | { readonly status: "ready"; readonly collection: PointProductCollection; readonly productId: string; readonly sessionKey: string };

function formatPrice(product: PointProduct) {
  return new Intl.NumberFormat("ja-JP", {
    currency: product.price.currency,
    style: "currency",
  }).format(product.price.amount);
}

function ProductDetail({ product }: { readonly product: PointProduct }) {
  const reason = product.ineligible_reason
    ? pointProductIneligibleReasonLabels[product.ineligible_reason]
    : null;
  const limitedBonus = product.limited_bonus;

  return (
    <article className="point-purchase-detail">
      <header className="point-purchase-detail__header">
        <p>COIN PURCHASE DETAIL</p>
        <h1>{presentCoinTerminology(product.title)}</h1>
      </header>
      <section aria-labelledby="point-purchase-summary-title" className="point-purchase-detail__summary">
        <header>
          <p>SUMMARY</p>
          <h2 id="point-purchase-summary-title">購入内容</h2>
        </header>
        <dl className="point-purchase-detail__facts">
          <div>
            <dt>支払金額</dt>
            <dd>{formatPrice(product)}</dd>
          </div>
          <div>
            <dt>獲得コイン</dt>
            <dd><strong>{pointProductNumber.format(product.grant.total_points)}</strong><span>コイン</span></dd>
          </div>
        </dl>
        {limitedBonus?.presentation.is_visible ? <LimitedBonusPresentation limitedBonus={limitedBonus} /> : null}
      </section>
      <section aria-labelledby="point-purchase-conditions-title" className="point-purchase-detail__conditions">
        <header>
          <p>PRODUCT INFORMATION</p>
          <h2 id="point-purchase-conditions-title">商品情報</h2>
        </header>
        <dl>
          <div><dt>対象</dt><dd>{product.audience.label}</dd></div>
          <div><dt>販売状態</dt><dd data-sale-state={product.sale_state}>{pointProductSaleStateLabels[product.sale_state]}</dd></div>
          <div>
            <dt>購入条件</dt>
            <dd data-eligible={product.eligible}>{product.eligible ? "購入対象です。" : reason ?? "現在購入できません。"}</dd>
          </div>
        </dl>
      </section>
    </article>
  );
}

export function PointPurchaseDetail({ productId }: { readonly productId: string }) {
  const { state: session } = useSession();
  const { client } = usePointClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<DetailState>(
    client ? { status: "loading" } : { status: "configuration-unavailable" },
  );
  const sessionKey = session.status === "authenticated"
    ? session.session.user?.id ?? null
    : session.status === "unauthenticated" || session.status === "session-expired"
      ? "anonymous"
      : null;

  useEffect(() => {
    if (!client || !sessionKey) return;
    let active = true;
    void client.listPointProducts()
      .then(({ data }) => {
        if (active) setState({ collection: data, productId, sessionKey, status: "ready" });
      })
      .catch((error: unknown) => {
        if (active) setState({ problem: presentPlatformProblem(error), productId, sessionKey, status: "error" });
      });
    return () => { active = false; };
  }, [client, productId, requestKey, sessionKey]);

  const displayState = useMemo<DetailState>(() => !client
    ? { status: "configuration-unavailable" }
    : session.status === "configuration-unavailable"
      ? { status: "configuration-unavailable" }
      : session.status === "error"
        ? { status: "session-error" }
        : !sessionKey
          || (state.status === "ready" || state.status === "error")
          && (state.sessionKey !== sessionKey || state.productId !== productId)
          ? { status: "loading" }
          : state, [client, productId, session.status, sessionKey, state]);

  if (displayState.status === "loading") return <CatalogLoading label="コイン購入詳細を読み込み中" />;
  if (displayState.status === "configuration-unavailable") {
    return <CatalogMessage description="この環境ではコイン商品への接続が設定されていません。" eyebrow="CONFIGURATION" title="コイン購入詳細を表示できません" />;
  }
  if (displayState.status === "session-error") {
    return <CatalogMessage description="Sessionを確認できませんでした。時間をおいて再度お試しください。" eyebrow="ERROR" title="コイン購入詳細を表示できません" tone="error" />;
  }
  if (displayState.status === "error") {
    return (
      <CatalogMessage
        action={() => { setState({ status: "loading" }); setRequestKey((value) => value + 1); }}
        description={displayState.problem.message}
        eyebrow="ERROR"
        title="コイン商品を取得できませんでした"
        tone="error"
      />
    );
  }

  const product = displayState.collection.data.find((candidate) => candidate.id === productId);
  if (!product) {
    return <CatalogMessage description="指定されたコイン商品は公開されていないか、見つかりません。" eyebrow="NOT FOUND" title="コイン商品が見つかりません" />;
  }
  return <ProductDetail product={product} />;
}

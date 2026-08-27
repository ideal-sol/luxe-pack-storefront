"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import {
  presentPlatformProblem,
  type PlatformProblemPresentation,
  type PointProduct,
  type PointProductAudienceCode,
  type PointProductCollection,
  type PointProductIneligibleReason,
  type PointProductSaleState,
} from "@/lib/platform";
import { pointPurchaseDetailRoute } from "@/lib/routes/navigation";
import { usePointClient, type PointWalletState } from "./point-client-provider";

const pointProductCategories: ReadonlyArray<{
  readonly id: PointProductAudienceCode;
  readonly label: string;
}> = [
  { id: "all_users", label: "すべてのユーザー" },
  { id: "first_purchase_users", label: "初回ユーザー" },
];

export const pointProductSaleStateLabels: Readonly<Record<PointProductSaleState, string>> = {
  available: "販売中",
  coming_soon: "販売開始前",
  ended: "販売終了",
};

export const pointProductIneligibleReasonLabels: Readonly<Record<Exclude<PointProductIneligibleReason, null>, string>> = {
  authentication_required: "購入するにはログインが必要です。",
  audience_not_eligible: "この商品の対象条件を満たしていません。",
  first_purchase_required: "過去にコイン購入があるため、初回ユーザー対象外です。",
  sale_ended: "この商品の販売は終了しました。",
  sale_not_started: "この商品の販売はまだ開始されていません。",
};

export const pointProductNumber = new Intl.NumberFormat("ja-JP");
const yen = new Intl.NumberFormat("ja-JP", { currency: "JPY", style: "currency" });
const jstDateTime = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

export function presentCoinTerminology(value: string) {
  return value.split("ポイント").join("コイン");
}

type ProductState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "session-error" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation; readonly sessionKey: string }
  | { readonly status: "ready"; readonly collection: PointProductCollection; readonly sessionKey: string };

export function PointBalanceSummary({ wallet }: { readonly wallet: PointWalletState }) {
  const value = wallet.status === "ready" ? pointProductNumber.format(wallet.balance.total_points) : "--";
  return (
    <section aria-labelledby="point-balance-title" className="point-balance-summary">
      <div>
        <p>COIN BALANCE</p>
        <h2 id="point-balance-title">現在のコイン</h2>
        {wallet.status === "unauthenticated" && <small>ログイン後に残高を表示します。</small>}
        {wallet.status === "error" && <small>{wallet.problem.message}</small>}
        {wallet.status === "session-error" && <small>ログインしてからご覧ください</small>}
        {wallet.status === "configuration-unavailable" && <small>エラーが発生しました。運営までお問い合わせください</small>}
      </div>
      <output aria-label="現在のコイン残高" aria-live="polite">
        {wallet.status === "loading" ? <span className="point-balance-summary__loading">読み込み中</span> : value}
      </output>
      {wallet.status === "ready" && (
        <div className="point-balance-summary__expiry">
          <h3>7日以内に失効するコイン</h3>
          {wallet.balance.expiring_within_7_days.length === 0 ? (
            <p>7日以内に失効するコインはありません。</p>
          ) : (
            <ul aria-label="7日以内に失効するコイン一覧">
              {wallet.balance.expiring_within_7_days.map((bucket, index) => (
                <li key={`${bucket.expires_at}-${index}`}>
                  <strong>{pointProductNumber.format(bucket.amount)} コイン</strong>
                  <time dateTime={bucket.expires_at}>{jstDateTime.format(new Date(bucket.expires_at))}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export function PointProductCardShell({
  action,
  badge,
  children,
}: {
  readonly action?: React.ReactNode;
  readonly badge?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <article className="point-product-card">
      {badge ? <div className="point-product-card__badge">{badge}</div> : null}
      <div className="point-product-card__body">{children}</div>
      {action ? <div className="point-product-card__action">{action}</div> : null}
    </article>
  );
}

function ProductCta({ product }: { readonly product: PointProduct }) {
  if (product.cta.state === "enabled" && product.cta.action === "login") {
    return <Link className="button button--dark" href="/login">ログインして確認</Link>;
  }
  if (product.cta.state === "enabled" && product.cta.action === "purchase") {
    return null;
  }
  return <button className="button button--ghost" data-platform-cta-state={product.cta.state} disabled type="button">現在購入できません</button>;
}

export function LimitedBonusPresentation({ limitedBonus }: { readonly limitedBonus: NonNullable<PointProduct["limited_bonus"]> }) {
  if (!limitedBonus.presentation.is_visible) return null;
  return (
    <section
      aria-label={presentCoinTerminology(limitedBonus.presentation.label)}
      className="point-product-card__limited-bonus"
      data-limited-bonus-state={limitedBonus.state}
    >
      <p>
        <span>{presentCoinTerminology(limitedBonus.presentation.label)}</span>
        {limitedBonus.presentation.amount_text ? <strong>{presentCoinTerminology(limitedBonus.presentation.amount_text)}</strong> : null}
      </p>
      {(limitedBonus.starts_at || limitedBonus.ends_at) && (
        <dl aria-label={`${presentCoinTerminology(limitedBonus.presentation.label)}の期間`}>
          {limitedBonus.starts_at && <div><dt>開始</dt><dd><time dateTime={limitedBonus.starts_at}>{jstDateTime.format(new Date(limitedBonus.starts_at))}</time></dd></div>}
          {limitedBonus.ends_at && <div><dt>終了</dt><dd><time dateTime={limitedBonus.ends_at}>{jstDateTime.format(new Date(limitedBonus.ends_at))}</time></dd></div>}
        </dl>
      )}
    </section>
  );
}

function PointProductCard({ product }: { readonly product: PointProduct }) {
  const reason = product.ineligible_reason ? pointProductIneligibleReasonLabels[product.ineligible_reason] : null;
  const limitedBonus = product.limited_bonus;
  return (
    <PointProductCardShell
      action={(
        <div className="point-product-card__actions">
          <Link className="button button--ghost" href={pointPurchaseDetailRoute(product.id)}>詳細を見る</Link>
          <ProductCta product={product} />
        </div>
      )}
      badge={product.audience.label}
    >
      <div className="point-product-card__heading">
        <h3>{presentCoinTerminology(product.title)}</h3>
        <span data-sale-state={product.sale_state}>{pointProductSaleStateLabels[product.sale_state]}</span>
      </div>
      <p className="point-product-card__grant"><strong>{pointProductNumber.format(product.grant.total_points)}</strong><span>コイン</span></p>
      {limitedBonus?.presentation.is_visible ? <LimitedBonusPresentation limitedBonus={limitedBonus} /> : null}
      <dl className="point-product-card__facts">
        <div><dt>販売価格</dt><dd>{yen.format(product.price.amount)}</dd></div>
      </dl>
      {!product.eligible && (
        <p className="point-product-card__eligibility point-product-card__eligibility--ineligible">
          {reason ?? "現在購入できません。"}
        </p>
      )}
    </PointProductCardShell>
  );
}

export function PointProductRegion({ products }: { readonly products: readonly PointProduct[] }) {
  return (
    <section aria-labelledby="point-products-title" className="point-product-section">
      <header>
        <p>COIN PRODUCTS</p>
        <h2 id="point-products-title">コイン商品</h2>
      </header>
      {products.length > 0 ? (
        <div className="point-product-grid">{products.map((product) => <PointProductCard key={product.id} product={product} />)}</div>
      ) : (
        <CatalogMessage description="現在、このカテゴリーで表示できるコイン商品はありません。" eyebrow="EMPTY" title="コイン商品はありません" />
      )}
    </section>
  );
}

export function PointPurchasePage() {
  const { state: session } = useSession();
  const { client, wallet } = usePointClient();
  const [category, setCategory] = useState<PointProductAudienceCode>("all_users");
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<ProductState>(client ? { status: "loading" } : { status: "configuration-unavailable" });
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sessionKey = session.status === "authenticated"
    ? session.session.user?.id ?? null
    : session.status === "unauthenticated" || session.status === "session-expired"
      ? "anonymous"
      : null;

  useEffect(() => {
    if (!client || !sessionKey) return;
    let active = true;
    void client.listPointProducts()
      .then(({ data }) => { if (active) setState({ collection: data, sessionKey, status: "ready" }); })
      .catch((error: unknown) => { if (active) setState({ problem: presentPlatformProblem(error), sessionKey, status: "error" }); });
    return () => { active = false; };
  }, [client, requestKey, sessionKey]);

  const displayState = useMemo<ProductState>(() => !client
    ? { status: "configuration-unavailable" }
    : session.status === "error"
      ? { status: "session-error" }
      : !sessionKey || (state.status === "ready" || state.status === "error") && state.sessionKey !== sessionKey
        ? { status: "loading" }
        : state, [client, session.status, sessionKey, state]);

  const products = useMemo(() => displayState.status === "ready"
    ? displayState.collection.data.filter((product) => product.audience.code === category)
    : [], [category, displayState]);

  function selectCategory(index: number) {
    const item = pointProductCategories[index];
    if (!item) return;
    setCategory(item.id);
    tabRefs.current[index]?.focus();
  }

  function handleCategoryKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % pointProductCategories.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + pointProductCategories.length) % pointProductCategories.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = pointProductCategories.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectCategory(nextIndex);
  }

  return (
    <div className="point-purchase">
      <PointBalanceSummary wallet={wallet} />
      <section aria-labelledby="point-category-title" className="point-category-section">
        <header><p>PRODUCT CATEGORY</p><h2 id="point-category-title">商品カテゴリー</h2></header>
        <div aria-label="コイン商品カテゴリー" className="point-category-tabs" role="tablist">
          {pointProductCategories.map((item, index) => (
            <button
              aria-controls="point-product-panel"
              aria-selected={category === item.id}
              id={`point-category-${item.id}`}
              key={item.id}
              onKeyDown={(event) => handleCategoryKeyDown(event, index)}
              onClick={() => setCategory(item.id)}
              ref={(node) => { tabRefs.current[index] = node; }}
              role="tab"
              tabIndex={category === item.id ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <div aria-labelledby={`point-category-${category}`} id="point-product-panel" role="tabpanel">
        {displayState.status === "loading" && <CatalogLoading label="コイン商品を読み込み中" />}
        {displayState.status === "configuration-unavailable" && <CatalogMessage description="コイン商品を表示できませんでした、時間をおいて再度お試しください" eyebrow="ERROR" title="コイン商品を表示できません" tone="error" />}
        {displayState.status === "session-error" && <CatalogMessage description="現在、コイン商品を表示できませんでした、時間をおいて再度お試しください" eyebrow="ERROR" title="コイン商品を表示できません" tone="error" />}
        {displayState.status === "error" && <CatalogMessage action={() => { setState({ status: "loading" }); setRequestKey((value) => value + 1); }} description={displayState.problem.message} eyebrow="ERROR" title="コイン商品を取得できませんでした" tone="error" />}
        {displayState.status === "ready" && <PointProductRegion products={products} />}
      </div>
    </div>
  );
}

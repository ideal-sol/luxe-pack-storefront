"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  firstBuyLayoutDetailHref,
  firstBuyLayoutHref,
  firstBuyLayoutOffer,
  type FirstBuyLayoutState,
} from "@/lib/presentation/first-buy-layout";
import { FirstBuyCoinCard, FirstBuyHero, FirstBuyStrip } from "./first-buy-offer";
import { PointProductCardShell } from "./point-purchase-page";

const number = new Intl.NumberFormat("ja-JP");
const yen = new Intl.NumberFormat("ja-JP", { currency: "JPY", style: "currency" });
const stateLabels = { active: "期限内", expired: "期限切れ", unauthenticated: "未ログイン" } as const;

export function FirstBuyLayoutNotice({ path, state }: { readonly path: string; readonly state: FirstBuyLayoutState }) {
  return (
    <aside aria-label="レイアウト確認" className="fb-preview-note">
      <p><strong>レイアウト確認用サンプル：{stateLabels[state]}</strong>　残り時間・価格・残高は固定表示です。購入はできません。</p>
      <nav aria-label="表示パターン">
        {(["active", "expired", "unauthenticated"] as const).map(value => <Link aria-current={value === state ? "page" : undefined} href={firstBuyLayoutHref(path, value)} key={value}>{stateLabels[value]}</Link>)}
        {path === "/" && state === "active" && <Link href="/?first_buy=active&popup=1">ポップアップを確認</Link>}
      </nav>
    </aside>
  );
}

/** A standalone sample list: never receives a Platform product or a payment client. */
export function FirstBuyPointsLayout({ state }: { readonly state: FirstBuyLayoutState }) {
  const offer = firstBuyLayoutOffer(state);
  const [category, setCategory] = useState(state === "active" ? "first" : "all");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs = [{ id: "all", label: "すべてのユーザー" }, { id: "first", label: state === "active" ? "初回ユーザー（24時間限定）" : "初回ユーザー" }];
  return (
    <div className="point-purchase" data-first-buy-layout-state={state}>
      <section aria-labelledby="point-balance-title" className="point-balance-summary">
        <div><p>COIN BALANCE</p><h2 id="point-balance-title">現在のコイン</h2>{state === "unauthenticated" && <small>ログイン後に残高を表示します。</small>}</div>
        <output aria-label="現在のコイン残高">{state === "unauthenticated" ? "--" : "1,000"}</output>
        {state !== "unauthenticated" && <div className="point-balance-summary__expiry"><h3>7日以内に失効するコイン</h3><p>7日以内に失効するコインはありません。</p></div>}
      </section>
      <FirstBuyHero offer={offer} />
      <section aria-labelledby="point-category-title" className="point-category-section">
        <header><p>PRODUCT CATEGORY</p><h2 id="point-category-title">商品カテゴリー</h2></header>
        <div aria-label="コイン商品カテゴリー" className="point-category-tabs" role="tablist">
          {tabs.map((tab, index) => (
            <button aria-controls="fb-product-panel" aria-selected={category === tab.id} id={`fb-tab-${tab.id}`} key={tab.id} onClick={() => setCategory(tab.id)} onKeyDown={event => {
              const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : ["ArrowLeft", "ArrowRight"].includes(event.key) ? 1 - index : null;
              if (next === null) return;
              event.preventDefault(); setCategory(tabs[next]!.id); tabRefs.current[next]?.focus();
            }} ref={node => { tabRefs.current[index] = node; }} role="tab" tabIndex={category === tab.id ? 0 : -1} type="button">{tab.label}</button>
          ))}
        </div>
      </section>
      <div aria-labelledby={`fb-tab-${category}`} id="fb-product-panel" role="tabpanel">
        <section aria-labelledby="point-products-title" className="point-product-section">
          <header><p>COIN PRODUCTS</p><h2 id="point-products-title">コイン商品</h2></header>
          {state === "active" && category === "first" && <FirstBuyStrip offer={offer} />}
          {state === "expired" && category === "first" ? <p className="catalog-message">現在、このカテゴリーで表示できるコイン商品はありません。</p> : (
            <div className="point-product-grid">{offer.deals.map(deal => state === "active" && category === "first" ? <FirstBuyCoinCard deal={deal} key={deal.product.id} /> : (
              <PointProductCardShell key={deal.product.id} badge={category === "first" ? "初回ユーザー" : "すべてのユーザー"} action={<div className="point-product-card__actions"><Link className="button button--ghost" href={firstBuyLayoutDetailHref(deal.product.id, state)}>詳細を見る</Link>{state === "unauthenticated" && <Link className="button button--dark" href="/login">ログインして確認</Link>}</div>}>
                <div className="point-product-card__heading"><h3>{number.format(deal.product.grant.total_points)}コイン</h3><span data-sale-state="available">販売中</span></div>
                <p className="point-product-card__grant"><strong>{number.format(deal.product.grant.total_points)}</strong><span>コイン</span></p>
                <dl className="point-product-card__facts"><div><dt>販売価格</dt><dd>{yen.format(category === "first" ? deal.product.price.amount : deal.referencePrice)}</dd></div></dl>
                {state === "unauthenticated" && <p className="point-product-card__eligibility point-product-card__eligibility--ineligible">購入するにはログインが必要です。</p>}
              </PointProductCardShell>
            ))}</div>
          )}
        </section>
      </div>
      <FirstBuyLayoutNotice path="/points" state={state} />
    </div>
  );
}

/** Existing detail classes, read-only; canonical ZIP adds no offer-specific detail design. */
export function FirstBuyDetailLayout({ state, productId }: { readonly state: FirstBuyLayoutState; readonly productId: string }) {
  const deal = firstBuyLayoutOffer(state).deals.find(value => value.product.id === productId);
  if (!deal) return null;
  const path = `/design/first-buy/purchase/${encodeURIComponent(productId)}`;
  return (
    <div className="point-purchase-detail" data-first-buy-layout-state={state}>
      <Link className="point-purchase-detail__back" href={firstBuyLayoutHref("/points", state)}>← コイン購入へ戻る</Link>
      <header className="point-purchase-detail__header"><p>COIN PURCHASE</p><h1>{number.format(deal.product.grant.total_points)}コイン</h1><span>{state === "active" ? "初回ユーザー（24時間限定）" : "すべてのユーザー"}</span></header>
      <section aria-labelledby="point-purchase-summary-title" className="point-purchase-detail__summary">
        <header><p>SUMMARY</p><h2 id="point-purchase-summary-title">購入内容</h2></header>
        <dl className="point-purchase-detail__facts">
          <div><dt>支払金額</dt><dd>{yen.format(state === "active" ? deal.product.price.amount : deal.referencePrice)}</dd></div>
          <div><dt>獲得コイン</dt><dd><strong>{number.format(deal.product.grant.total_points)}</strong><span>コイン</span></dd></div>
          <div className="point-purchase-detail__total"><dt>合計コイン</dt><dd><strong>{number.format(deal.product.grant.total_points)}</strong><span>コイン</span></dd></div>
        </dl>
      </section>
      {state === "expired" && <p>初回限定の表示期間は終了しました。通常商品をご覧ください。</p>}
      {state === "unauthenticated" && <Link className="button button--dark" href="/login">ログインして確認</Link>}
      <button className="button button--dark" disabled type="button">購入する（レイアウト確認のみ）</button>
      <FirstBuyLayoutNotice path={path} state={state} />
    </div>
  );
}

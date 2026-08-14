"use client";

import { Children, useRef, useState } from "react";
import { CatalogMessage } from "@/components/catalog/catalog-message";

const pointProductCategories = [
  { id: "all", label: "すべてのユーザー" },
  { id: "first-time", label: "初回ユーザー" },
] as const;

type PointProductCategory = (typeof pointProductCategories)[number]["id"];

export function PointBalanceSummary({ value }: { readonly value: React.ReactNode }) {
  return (
    <section aria-labelledby="point-balance-title" className="point-balance-summary">
      <div>
        <p>POINT BALANCE</p>
        <h2 id="point-balance-title">現在のポイント</h2>
      </div>
      <output aria-label="現在のポイント残高">{value}</output>
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

export function PointProductRegion({ children }: { readonly children?: React.ReactNode }) {
  const hasProducts = Children.count(children) > 0;
  return (
    <section aria-labelledby="point-products-title" className="point-product-section">
      <header>
        <p>POINT PRODUCTS</p>
        <h2 id="point-products-title">ポイント商品</h2>
      </header>
      {hasProducts ? (
        <div className="point-product-grid">{children}</div>
      ) : (
        <CatalogMessage
          description="現在、ポイント商品の提供準備を進めています。"
          eyebrow="EMPTY"
          title="ポイント商品を準備中です。"
        />
      )}
    </section>
  );
}

export function PointPurchasePage({ productContent }: { readonly productContent?: React.ReactNode }) {
  const [category, setCategory] = useState<PointProductCategory>("all");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
      <PointBalanceSummary value="--" />

      <section aria-labelledby="point-category-title" className="point-category-section">
        <header>
          <p>PRODUCT CATEGORY</p>
          <h2 id="point-category-title">商品カテゴリー</h2>
        </header>
        <div aria-label="ポイント商品カテゴリー" className="point-category-tabs" role="tablist">
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

      <div
        aria-labelledby={`point-category-${category}`}
        data-category={category}
        id="point-product-panel"
        role="tabpanel"
      >
        <PointProductRegion>{productContent}</PointProductRegion>
      </div>
    </div>
  );
}

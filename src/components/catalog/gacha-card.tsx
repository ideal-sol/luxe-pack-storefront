import Link from "next/link";
import type { GachaSummary } from "@/lib/platform";
import { CatalogAsset } from "./catalog-asset";
import { gachaPresentationReasonLabels, gachaSaleStateLabels } from "./gacha-presentation";

const points = new Intl.NumberFormat("ja-JP");

export function GachaCard({ gacha, priority = false }: { readonly gacha: GachaSummary; readonly priority?: boolean }) {
  const asset = gacha.presentation_asset?.media_type === "image" ? gacha.presentation_asset : null;
  const presentation = gacha.presentation;
  const display = presentation?.display;
  const showPricePoints = display?.show_price_points ?? true;
  const showTotalCount = display?.show_total_count ?? true;
  const showDrawnCount = display?.show_drawn_count === true && gacha.drawn_count !== undefined;
  return (
    <article className="gacha-card">
      <Link aria-label={`${gacha.title}の詳細を見る`} className="gacha-card__image" href={`/gachas/${gacha.slug}`}>
        <CatalogAsset alt={asset?.alt_text ?? gacha.title} priority={priority} {...(asset?.path ? { src: asset.path } : {})} />
        <span className="gacha-card__category">{gacha.category.name}</span>
      </Link>
      <div className="gacha-card__body">
        <div className="gacha-card__tags" aria-label="タグ">
          {gacha.tags.slice(0, 2).map((tag) => <span key={tag.id}>{tag.name}</span>)}
        </div>
        <h3><Link href={`/gachas/${gacha.slug}`}>{gacha.title}</Link></h3>
        {presentation && (
          <div
            aria-label="販売・対象状態"
            className="gacha-card__presentation"
            data-cta-action={presentation.cta.action ?? "none"}
            data-cta-state={presentation.cta.state}
          >
            <span className={`gacha-card__sale-state gacha-card__sale-state--${presentation.sale_state}`}>
              {gachaSaleStateLabels[presentation.sale_state]}
            </span>
            <span>
              {presentation.eligible
                ? "抽選対象"
                : presentation.ineligible_reason
                  ? gachaPresentationReasonLabels[presentation.ineligible_reason]
                  : "現在は抽選を利用できません"}
            </span>
          </div>
        )}
        <div className="gacha-card__meta">
          {showPricePoints && <p><strong>{points.format(gacha.price_points)}</strong><span>コイン / 1回</span></p>}
          <p aria-label={showTotalCount ? `残り${gacha.remaining_count}口、全${gacha.total_count}口` : `残り${gacha.remaining_count}口`}>
            <span>残り</span><strong>{points.format(gacha.remaining_count)}</strong>
            {showTotalCount && <small>/ {points.format(gacha.total_count)}</small>}
          </p>
          {showDrawnCount && <p aria-label={`抽選済み${gacha.drawn_count}回`}><span>抽選済み</span><strong>{points.format(gacha.drawn_count!)}</strong><small>回</small></p>}
        </div>
      </div>
    </article>
  );
}

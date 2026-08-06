import Link from "next/link";
import type { GachaSummary } from "@/lib/platform";
import { CatalogAsset } from "./catalog-asset";

const points = new Intl.NumberFormat("ja-JP");

export function GachaCard({ gacha, priority = false }: { readonly gacha: GachaSummary; readonly priority?: boolean }) {
  const asset = gacha.presentation_asset?.media_type === "image" ? gacha.presentation_asset : null;
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
        <div className="gacha-card__meta">
          <p><strong>{points.format(gacha.price_points)}</strong><span>pt / 1回</span></p>
          <p aria-label={`残り${gacha.remaining_count}口、全${gacha.total_count}口`}>
            <span>残り</span><strong>{points.format(gacha.remaining_count)}</strong><small>/ {points.format(gacha.total_count)}</small>
          </p>
        </div>
      </div>
    </article>
  );
}

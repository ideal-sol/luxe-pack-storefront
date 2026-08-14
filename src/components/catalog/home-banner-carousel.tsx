"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { ContentBanner } from "@/lib/platform";
import { CatalogAsset } from "./catalog-asset";

function Banner({ banner, priority }: { readonly banner: ContentBanner; readonly priority: boolean }) {
  const content = (
    <>
      <CatalogAsset
        alt={banner.title}
        fallbackLabel="BANNER PREPARING"
        priority={priority}
        src={banner.image_url ?? null}
      />
      <div className="home-banner__caption"><span>FEATURED</span><strong>{banner.title}</strong></div>
    </>
  );

  return banner.link_url ? (
    <Link aria-label={`${banner.title}を見る`} className="home-banner" href={banner.link_url}>{content}</Link>
  ) : (
    <div className="home-banner">{content}</div>
  );
}

export function HomeBannerCarousel({ banners }: { readonly banners: readonly ContentBanner[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const multiple = banners.length > 1;

  function select(index: number) {
    const nextIndex = Math.min(Math.max(index, 0), banners.length - 1);
    setActiveIndex(nextIndex);
    const rail = railRef.current;
    if (rail) rail.scrollTo?.({ behavior: "auto", left: rail.clientWidth * nextIndex });
  }

  function handleScroll() {
    const rail = railRef.current;
    if (!rail || rail.clientWidth === 0) return;
    setActiveIndex(Math.min(Math.round(rail.scrollLeft / rail.clientWidth), banners.length - 1));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!multiple || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    select(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
  }

  return (
    <div
      aria-label="トップバナー"
      aria-roledescription="カルーセル"
      className="home-banner-carousel"
      onKeyDown={handleKeyDown}
      role="region"
      tabIndex={multiple ? 0 : undefined}
    >
      <div className="home-banners__rail" onScroll={handleScroll} ref={railRef}>
        {banners.map((banner, index) => (
          <div
            aria-label={`${index + 1} / ${banners.length}`}
            aria-roledescription="スライド"
            className="home-banner-carousel__slide"
            key={banner.id}
            role="group"
          >
            <Banner banner={banner} priority={index === 0} />
          </div>
        ))}
      </div>
      {multiple && (
        <div className="home-banner-carousel__controls">
          <button aria-label="前のバナー" disabled={activeIndex === 0} onClick={() => select(activeIndex - 1)} type="button">←</button>
          <div aria-label={`${banners.length}件中${activeIndex + 1}件目`} className="home-banner-carousel__indicators" role="group">
            {banners.map((banner, index) => (
              <button
                aria-current={index === activeIndex ? "true" : undefined}
                aria-label={`${index + 1}件目のバナーを表示`}
                key={banner.id}
                onClick={() => select(index)}
                type="button"
              />
            ))}
          </div>
          <button aria-label="次のバナー" disabled={activeIndex === banners.length - 1} onClick={() => select(activeIndex + 1)} type="button">→</button>
        </div>
      )}
    </div>
  );
}

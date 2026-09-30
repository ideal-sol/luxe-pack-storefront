"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
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
    </>
  );

  return banner.link_url ? (
    <Link aria-label={`${banner.title}を見る`} className="home-banner" href={banner.link_url}>{content}</Link>
  ) : (
    <div className="home-banner">{content}</div>
  );
}

/** 自動送りの間隔（デザインの注目の企画カルーセルと同じ約3.4秒）。 */
export const homeBannerAutoplayIntervalMs = 3400;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
}

function readReducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia(reducedMotionQuery).matches;
}

/** OSの「動きを減らす」設定。サーバー描画時は false として扱う。 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
}

export function HomeBannerCarousel({ banners }: { readonly banners: readonly ContentBanner[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const multiple = banners.length > 1;

  const scrollToIndex = useCallback((index: number) => {
    const rail = railRef.current;
    const slide = rail?.children.item(index) as HTMLElement | null | undefined;
    if (!rail || !slide) return;
    rail.scrollTo?.({ behavior: reducedMotion ? "instant" : "smooth", left: slide.offsetLeft - (rail.clientWidth - slide.clientWidth) / 2 });
  }, [reducedMotion]);

  function select(index: number) {
    // 自動送りと同じく、端まで来たら反対側へ戻る
    const nextIndex = ((index % banners.length) + banners.length) % banners.length;
    setActiveIndex(nextIndex);
    scrollToIndex(nextIndex);
  }

  function handleScroll() {
    const rail = railRef.current;
    if (!rail || rail.clientWidth === 0) return;
    const center = rail.scrollLeft + rail.clientWidth / 2;
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    Array.from(rail.children).forEach((child, index) => {
      const element = child as HTMLElement;
      const gap = Math.abs(element.offsetLeft + element.clientWidth / 2 - center);
      if (gap < distance) {
        distance = gap;
        nearest = index;
      }
    });
    setActiveIndex(nearest);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!multiple || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    select(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
  }

  useEffect(() => {
    activeRef.current = activeIndex;
  }, [activeIndex]);

  // 自動送り：ポインターが乗っている間・操作中・停止ボタン押下時・動きを減らす設定では止める。
  const autoplay = multiple && playing && !hovered && !focused && !reducedMotion;
  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      const nextIndex = (activeRef.current + 1) % banners.length;
      activeRef.current = nextIndex;
      setActiveIndex(nextIndex);
      scrollToIndex(nextIndex);
    }, homeBannerAutoplayIntervalMs);
    return () => window.clearInterval(timer);
  }, [autoplay, banners.length, scrollToIndex]);

  return (
    <div
      aria-label="トップバナー"
      aria-roledescription="カルーセル"
      className="home-banner-carousel"
      data-autoplay={autoplay ? "on" : "off"}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onFocus={() => setFocused(true)}
      onKeyDown={handleKeyDown}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      role="region"
      tabIndex={multiple ? 0 : undefined}
    >
      <div className="home-banners__rail" onScroll={handleScroll} ref={railRef}>
        {banners.map((banner, index) => (
          <div
            aria-label={`${index + 1} / ${banners.length}`}
            aria-roledescription="スライド"
            className="home-banner-carousel__slide"
            data-active={index === activeIndex ? "true" : undefined}
            key={banner.id}
            role="group"
          >
            <Banner banner={banner} priority={index === 0} />
          </div>
        ))}
      </div>
      {multiple && (
        <div className="home-banner-carousel__controls">
          <button aria-label="前のバナー" className="home-banner-carousel__arrow home-banner-carousel__arrow--prev" onClick={() => select(activeIndex - 1)} type="button">◀</button>
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
          <button aria-label="次のバナー" className="home-banner-carousel__arrow home-banner-carousel__arrow--next" onClick={() => select(activeIndex + 1)} type="button">▶</button>
          {!reducedMotion && (
            <button
              aria-label={playing ? "自動再生を停止" : "自動再生を開始"}
              aria-pressed={!playing}
              className="home-banner-carousel__toggle"
              onClick={() => setPlaying((value) => !value)}
              type="button"
            >
              {playing ? "❚❚" : "▶"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useOptionalPublicClient } from "./public-client-provider";

/** 背後に漂うカードの配置（デザイン top.html の値。左・上・幅・傾き・不透明度・周期）。 */
const slots = [
  { left: "-3%", top: "12%", width: 200, rotate: -11, opacity: 0.22, duration: 11 },
  { left: "86%", top: "8%", width: 185, rotate: 10, opacity: 0.2, duration: 13 },
  { left: "76%", top: "62%", width: 150, rotate: -7, opacity: 0.15, duration: 15 },
  { left: "4%", top: "64%", width: 160, rotate: 8, opacity: 0.15, duration: 12 },
] as const;

/**
 * メインビジュアルの背後に漂う、ぼかしたガチャ画像（装飾）。
 * 公開中ガチャの画像をそのまま使い、取得できないときは何も出さない。
 */
export function HomeHeroCards() {
  const client = useOptionalPublicClient();
  const [images, setImages] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.listGachas({ limit: slots.length })
      .then(({ data }) => {
        if (!active) return;
        setImages(data.data
          .map((gacha) => (gacha.presentation_asset?.media_type === "image" ? gacha.presentation_asset.path : null))
          .filter((path): path is string => Boolean(path?.startsWith("/") && !path.startsWith("//"))));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [client]);

  if (images.length === 0) return null;
  return (
    <div aria-hidden="true" className="home-hero__layer home-hero__cards">
      {slots.map((slot, index) => {
        const image = images[index % images.length];
        return (
          <div
            className="home-hero__card"
            key={slot.left}
            style={{
              animationDelay: `${index * 1.6}s`,
              animationDuration: `${slot.duration}s`,
              left: slot.left,
              opacity: slot.opacity,
              top: slot.top,
              width: slot.width,
              ["--rz" as string]: `${slot.rotate}deg`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 装飾用の公開画像。最適化対象外 */}
            <img alt="" src={image} />
          </div>
        );
      })}
    </div>
  );
}

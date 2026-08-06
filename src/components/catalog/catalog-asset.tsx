"use client";

import Image from "next/image";
import { useState } from "react";

export function CatalogAsset({
  alt,
  fallbackLabel = "IMAGE PREPARING",
  priority = false,
  src,
}: {
  readonly alt?: string | null;
  readonly fallbackLabel?: string;
  readonly priority?: boolean;
  readonly src?: string | null;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = Boolean(src?.startsWith("/") && !src.startsWith("//") && failedSrc !== src);

  return (
    <div className="catalog-asset">
      {usable && src ? (
        <Image
          alt={alt ?? ""}
          fill
          onError={() => setFailedSrc(src)}
          priority={priority}
          sizes="(min-width: 1080px) 25vw, (min-width: 720px) 42vw, 90vw"
          src={src}
          unoptimized
        />
      ) : (
        <div aria-label={alt ?? "画像は準備中です"} className="catalog-asset__fallback" role="img">
          <span aria-hidden="true">LP</span>
          <small>{fallbackLabel}</small>
        </div>
      )}
    </div>
  );
}

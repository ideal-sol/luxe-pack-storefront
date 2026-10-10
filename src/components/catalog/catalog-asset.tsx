"use client";

import Image from "next/image";
import { resolveAssetUrl } from "@/lib/asset-url";
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
  const url = resolveAssetUrl(src);
  const usable = url && failedSrc !== url;

  return (
    <div className="catalog-asset">
      {usable ? (
        <Image
          alt={alt ?? ""}
          fill
          onError={() => setFailedSrc(url)}
          priority={priority}
          sizes="(min-width: 1080px) 25vw, (min-width: 720px) 42vw, 90vw"
          src={url}
          unoptimized
        />
      ) : (
        <div aria-label={alt ?? "画像は準備中です"} className="catalog-asset__fallback" role="img">
          <span aria-hidden="true">OZ</span>
          <small>{fallbackLabel}</small>
        </div>
      )}
    </div>
  );
}

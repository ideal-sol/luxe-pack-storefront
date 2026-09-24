"use client";

import Image from "next/image";
import { useState } from "react";
import type { GachaDetail } from "@/lib/platform";

export function RankLineupImage({ image, name }: {
  readonly image: GachaDetail["ranks"][number]["lineup_image"] | null | undefined;
  readonly name: string;
}) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const path = image?.media_type === "image" ? image.path : null;
  if (!path || !path.startsWith("/") || path.startsWith("//") || path === failedPath) return <span>{name}</span>;

  return (
    <span className="rank-lineup-image">
      <Image alt={image?.alt_text ?? name} fill onError={() => setFailedPath(path)} sizes="320px" src={path} unoptimized />
    </span>
  );
}

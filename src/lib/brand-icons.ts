import { brandAssetUrl } from "@/lib/brand-assets";
import type { Metadata, MetadataRoute } from "next";

/** オリポケのアイコン一式（public/brand/icons、2026-10-01 納品）を使うサイト名。ロゴ画像と同じ条件。 */
export const brandIconAppName = "オリポケ";

export function usesBrandIcons(siteName: string | undefined): boolean {
  return siteName?.trim() === brandIconAppName;
}

/** ブラウザのタブ・ブックマーク・ホーム画面に出すアイコン。 */
export const brandIcons: NonNullable<Metadata["icons"]> = {
  apple: [{ sizes: "180x180", type: "image/png", url: brandAssetUrl("icons/apple-touch-icon.png") }],
  icon: [
    { sizes: "any", url: brandAssetUrl("icons/favicon.ico") },
    { sizes: "16x16", type: "image/png", url: brandAssetUrl("icons/favicon-16.png") },
    { sizes: "32x32", type: "image/png", url: brandAssetUrl("icons/favicon-32.png") },
    { sizes: "48x48", type: "image/png", url: brandAssetUrl("icons/favicon-48.png") },
    { sizes: "180x180", type: "image/png", url: brandAssetUrl("icons/favicon-180.png") },
  ],
  shortcut: brandAssetUrl("icons/favicon.ico"),
};

/** Android のホーム画面追加用。 */
export const brandManifestIcons: NonNullable<MetadataRoute.Manifest["icons"]> = [
  { purpose: "any", sizes: "192x192", src: brandAssetUrl("icons/android-192.png"), type: "image/png" },
  { purpose: "any", sizes: "512x512", src: brandAssetUrl("icons/android-512.png"), type: "image/png" },
  { purpose: "maskable", sizes: "512x512", src: brandAssetUrl("icons/android-512-maskable.png"), type: "image/png" },
];

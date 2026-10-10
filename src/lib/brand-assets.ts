import { assetOrigin } from "./asset-url";
import manifest from "./brand-assets.manifest.json";

export const brandAssetVersion = manifest.version;

/** One version and one build-time base for all 23 retained local Brand files. */
export function brandAssetUrl(
  relativePath: string,
  base = process.env.NEXT_PUBLIC_STATIC_ASSET_BASE_URL,
): string {
  const entry = manifest.files.find((file) => file.relative_path === relativePath);
  if (!entry) throw new Error(`Unknown Brand asset: ${relativePath}`);
  const origin = base?.endsWith("/static-assets") ? assetOrigin(base.slice(0, -"/static-assets".length)) : null;
  return origin ? `${origin}/${entry.object_key}` : `/brand/${entry.relative_path}`;
}

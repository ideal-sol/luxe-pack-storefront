/** Only the configured HTTPS origin can receive Platform presentation paths. */
export function assetOrigin(value: string): string | null {
  // Check the raw spelling before URL parsing can normalize credentials, paths,
  // whitespace, escapes or default ports into an apparently valid origin.
  if (!/^https:\/\/[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.hostname.split(".").some((label) => !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

const publicPrefixes = ["/gacha/", "/top-banner/", "/rank-masters/", "/rank-effects/"];

export function resolveAssetUrl(
  path: string | null | undefined,
  base = process.env.NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL,
): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  // Literal ASCII segments only: no URL normalization, encoding or traversal.
  if (!path.slice(1).split("/").every((segment) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(segment))) return null;
  if (!base) return path;
  const origin = assetOrigin(base);
  if (!origin || !publicPrefixes.some((prefix) => path.startsWith(prefix))) return null;
  return `${origin}${path}`;
}

import type { MetadataRoute } from "next";
import { brandManifestIcons, usesBrandIcons } from "@/lib/brand-icons";

export default function manifest(): MetadataRoute.Manifest {
  const siteName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "OripaZ";
  return {
    background_color: "#ffffff",
    display: "standalone",
    name: siteName,
    short_name: siteName,
    start_url: "/",
    theme_color: "#00beb1",
    ...(usesBrandIcons(siteName) ? { icons: brandManifestIcons } : {}),
  };
}

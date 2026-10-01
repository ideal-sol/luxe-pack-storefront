import { Suspense } from "react";
import { AdvertisingCapture } from "@/components/advertising/advertising-capture";
import type { Metadata, Viewport } from "next";
import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MotionEffects } from "@/components/common/motion-effects";
import { ToastProvider } from "@/components/common/toast-provider";
import { SessionProvider } from "@/components/auth/session-provider";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import { PointClientProvider } from "@/components/points/point-client-provider";
import { brandIcons, usesBrandIcons } from "@/lib/brand-icons";
import "@/styles/font-noto-sans-jp.css";
import "@/styles/globals.css";
import "@/styles/theme-oripoke.css";

const siteName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "OripaZ";

export const metadata: Metadata = {
  description: `${siteName} ポケモンカード専門のオンラインオリパ`,
  ...(usesBrandIcons(siteName) ? { icons: brandIcons } : {}),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#00beb1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <Suspense fallback={null}><AdvertisingCapture /></Suspense>
        <ToastProvider>
          <SessionProvider>
            <PointClientProvider>
              <PublicClientProvider>
                <MotionEffects />
                <SiteHeader />
                <main className="site-main">{children}</main>
                <SiteFooter />
                <MobileBottomNavigation />
              </PublicClientProvider>
            </PointClientProvider>
          </SessionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

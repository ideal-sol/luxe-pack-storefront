import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ToastProvider } from "@/components/common/toast-provider";
import { SessionProvider } from "@/components/auth/session-provider";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import { PointClientProvider } from "@/components/points/point-client-provider";
import "@/styles/globals.css";

const notoSansJp = Noto_Sans_JP({
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  description: "OripaZ customer storefront.",
  title: {
    default: "OripaZ",
    template: "%s | OripaZ",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#161513",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={notoSansJp.variable}>
      <body>
        <ToastProvider>
          <SessionProvider>
            <PointClientProvider>
              <PublicClientProvider>
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

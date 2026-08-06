import type { Metadata, Viewport } from "next";
import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ToastProvider } from "@/components/common/toast-provider";
import { SessionProvider } from "@/components/auth/session-provider";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import "@/styles/globals.css";

export const metadata: Metadata = {
  description: "Luxe Pack customer storefront.",
  title: {
    default: "Luxe Pack",
    template: "%s | Luxe Pack",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#161513",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <ToastProvider>
          <SessionProvider>
            <PublicClientProvider>
              <SiteHeader />
              <main className="site-main">{children}</main>
              <SiteFooter />
              <MobileBottomNavigation />
            </PublicClientProvider>
          </SessionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

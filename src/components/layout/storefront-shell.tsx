"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { MemberRouteAccess } from "@/components/auth/member-access";
import { PointClientProvider } from "@/components/points/point-client-provider";
import { brandAssetUrl } from "@/lib/brand-assets";
import { usesPreRegisterShell } from "@/lib/pre-register";
import { MobileBottomNavigation } from "./mobile-bottom-navigation";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function StorefrontShell({ children, firstBuyLayoutEnabled }: {
  readonly children: React.ReactNode;
  readonly firstBuyLayoutEnabled: boolean;
}) {
  const pathname = usePathname();
  if (usesPreRegisterShell(pathname)) return <div className="pre-register-shell">
    <header className="pre-register-shell__header">
      <Image alt="オリポケ" height={74} loading="eager" src={brandAssetUrl("logo.webp")} unoptimized width={240} />
    </header>
    <main className="site-main">{children}</main>
  </div>;
  return <PointClientProvider>
    <SiteHeader firstBuyLayoutEnabled={firstBuyLayoutEnabled} />
    <main className="site-main"><MemberRouteAccess>{children}</MemberRouteAccess></main>
    <SiteFooter />
    <MobileBottomNavigation />
  </PointClientProvider>;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon } from "@/components/common/app-icon";
import { mobileNavigation } from "@/lib/routes/navigation";

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="モバイルナビゲーション" className="mobile-navigation">
      {mobileNavigation.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <Link aria-current={current ? "page" : undefined} href={item.href} key={item.href}>
            <AppIcon name={item.icon} size={21} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

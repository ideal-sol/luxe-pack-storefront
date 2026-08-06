import Link from "next/link";
import { accountNavigation, primaryNavigation } from "@/lib/routes/navigation";

const informationLinks = [
  { href: "/pages/guide", label: "ご利用ガイド" },
  { href: "/pages/terms", label: "利用規約" },
  { href: "/pages/privacy", label: "プライバシーポリシー" },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-container site-footer__grid">
        <div className="site-footer__brand">
          <span className="wordmark__seal" aria-hidden="true">LP</span>
          <div>
            <strong>LUXE PACK</strong>
            <p>選ぶ時間から、届く瞬間まで。</p>
          </div>
        </div>
        <div>
          <h2>Explore</h2>
          {primaryNavigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </div>
        <div>
          <h2>Account</h2>
          {accountNavigation.slice(0, 3).map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </div>
        <div>
          <h2>Information</h2>
          {informationLinks.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </div>
      </div>
      <div className="page-container site-footer__bottom">
        <p>© LUXE PACK</p>
        <p>Customer storefront foundation</p>
      </div>
    </footer>
  );
}

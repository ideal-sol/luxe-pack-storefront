import Link from "next/link";
import {
  accountNavigation,
  primaryNavigation,
} from "@/lib/routes/navigation";
import { FooterInformationNavigation } from "./footer-information-navigation";

export function SiteFooter() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME;
  return (
    <footer className="site-footer">
      <div className="page-container site-footer__grid">
        <div className="site-footer__brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
          <img alt="" aria-hidden="true" className="wordmark__mark" height={100} src="/brand/mark.svg" width={100} />
          <div>
            <strong>{appName}</strong>
            <p>ポケモンカード専門のオンラインオリジナルパック販売サイトです。獲得した景品は、景品ごとに利用可能な方法で発送依頼またはコイン交換を行えます。</p>
          </div>
        </div>
        <div>
          <h2>ご利用案内</h2>
          {primaryNavigation.filter((item) => item.href !== "/gachas").map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </div>
        <div>
          <h2>アカウント</h2>
          {accountNavigation.slice(0, 3).map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </div>
        <div className="site-footer__information">
          <h2>サイトについて</h2>
          <FooterInformationNavigation />
        </div>
      </div>
      <div className="page-container site-footer__bottom">
        <p>© {appName}</p>
        <p>ポケモンカード専門のオンラインオリパ</p>
      </div>
    </footer>
  );
}

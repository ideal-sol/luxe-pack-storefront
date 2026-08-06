import Link from "next/link";
import { primaryNavigation } from "@/lib/routes/navigation";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__utility">
        <div className="page-container site-header__utility-inner">
          <p>PREMIUM PACK EXPERIENCE</p>
          <nav aria-label="アカウント">
            <Link href="/register">新規登録</Link>
            <Link className="site-header__login" href="/login">
              ログイン
            </Link>
          </nav>
        </div>
      </div>
      <div className="page-container site-header__main">
        <Link aria-label="Luxe Pack ホーム" className="wordmark" href="/">
          <span className="wordmark__seal" aria-hidden="true">LP</span>
          <span>
            <strong>LUXE PACK</strong>
            <small>STORE FRONT</small>
          </span>
        </Link>
        <nav aria-label="メインナビゲーション" className="site-header__nav">
          {primaryNavigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
          <Link className="button button--dark button--compact" href="/mypage">
            マイページ
          </Link>
        </nav>
      </div>
    </header>
  );
}

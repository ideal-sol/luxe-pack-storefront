"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { useToast } from "@/components/common/toast-provider";
import { presentAuthProblem } from "@/lib/platform";
import { headerNavigation } from "@/lib/routes/navigation";
import { usePointClient } from "@/components/points/point-client-provider";

const pointNumber = new Intl.NumberFormat("ja-JP");
export const brandLogoAppName = "オリポケ";

import { ConnectedFirstBuyBar } from "@/components/points/first-buy-connected";
import { FirstBuyLayoutBar } from "@/components/points/first-buy-layout-bar";

export function SiteHeader({ firstBuyLayoutEnabled = false }: { readonly firstBuyLayoutEnabled?: boolean }) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME;
  // オリポケのロゴ画像（マーク＋ロゴ文字）はサイト名がオリポケのときだけ使う。他の名前ではマーク＋テキスト表示。
  const brandLogo = appName?.trim() === brandLogoAppName;
  const { logout, state } = useSession();
  const { showToast } = useToast();
  const { wallet } = usePointClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef<HTMLSpanElement>(null);

  // スクロールに追従して縮み、下端に読み進みのバーを出す（見た目のみ）
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      setScrolled(y > 40);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current?.style.setProperty("--progress", `${max > 0 ? Math.min(100, (y / max) * 100) : 0}%`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      showToast("ログアウト", "ログアウトしました。");
    } catch (error) {
      showToast("ログアウトできませんでした", presentAuthProblem(error).message);
    } finally {
      setLoggingOut(false);
    }
  }

  const authenticated = state.status === "authenticated";
  const unauthenticated = state.status === "unauthenticated" || state.status === "session-expired";
  return (
    <header className="site-header" data-scrolled={scrolled ? "true" : undefined}>
      <Suspense fallback={null}>{firstBuyLayoutEnabled ? <FirstBuyLayoutBar /> : <ConnectedFirstBuyBar />}</Suspense>
      <div className="page-container site-header__main">
        <div className="site-header__brand">
          <Link aria-label={appName ? `${appName} ホーム` : "ホーム"} className={brandLogo ? "wordmark wordmark--logo" : "wordmark"} href="/">
            {brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要
              <img alt="" aria-hidden="true" className="wordmark__logo" height={96} src="/brand/logo.webp" width={402} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要
              <img alt="" aria-hidden="true" className="wordmark__mark" height={100} src="/brand/mark.svg" width={100} />
            )}
            <strong className={brandLogo ? "wordmark__name wordmark__name--visually-hidden" : "wordmark__name"}>{appName}</strong>
          </Link>
          {brandLogo && <span className="site-header__badge">ポケカ専門</span>}
        </div>
        <nav aria-label="メインナビゲーション" className="site-header__nav">
          {headerNavigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
          {authenticated ? (
            <>
              <Link href="/mypage">マイページ</Link>
              <span aria-label="コイン残高" className="site-header__point">コイン {wallet.status === "ready" ? pointNumber.format(wallet.balance.total_points) : "--"}</span>
              <button className="button button--dark button--compact" disabled={loggingOut} onClick={handleLogout} type="button">
                {loggingOut ? "処理中…" : "ログアウト"}
              </button>
            </>
          ) : unauthenticated ? (
            <>
              <Link className="button button--dark button--compact" href="/login">ログイン</Link>
              <Link href="/register">新規登録</Link>
            </>
          ) : (
            <span className="site-header__auth-neutral" aria-label="認証状態を確認中">--</span>
          )}
        </nav>
        <nav aria-label="モバイルアカウント" className="site-header__mobile-account">
          {unauthenticated && <Link href="/register">新規登録</Link>}
          {unauthenticated && <Link className="site-header__login" href="/login">ログイン</Link>}
          {authenticated && <Link href="/mypage">マイページ</Link>}
          {authenticated && <Link aria-label="コイン残高" className="site-header__point site-header__point--mobile" href="/points">コイン {wallet.status === "ready" ? pointNumber.format(wallet.balance.total_points) : "--"}</Link>}
          {authenticated && (
            <button disabled={loggingOut} onClick={handleLogout} type="button">
              {loggingOut ? "処理中…" : "ログアウト"}
            </button>
          )}
          {!authenticated && !unauthenticated && <span aria-label="認証状態を確認中">--</span>}
        </nav>
      </div>
      <span aria-hidden="true" className="site-header__progress" ref={progressRef} />
    </header>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { useToast } from "@/components/common/toast-provider";
import { presentAuthProblem } from "@/lib/platform";
import { primaryNavigation } from "@/lib/routes/navigation";
import { usePointClient } from "@/components/points/point-client-provider";

const pointNumber = new Intl.NumberFormat("ja-JP");

export function SiteHeader() {
  const { logout, state } = useSession();
  const { showToast } = useToast();
  const { wallet } = usePointClient();
  const [loggingOut, setLoggingOut] = useState(false);

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
    <header className="site-header">
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
              <Link href="/register">新規登録</Link>
              <Link className="button button--dark button--compact" href="/login">ログイン</Link>
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
    </header>
  );
}

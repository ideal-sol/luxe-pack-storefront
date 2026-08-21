"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState, LoginRequiredState } from "@/components/common/state-panel";
import { useToast } from "@/components/common/toast-provider";
import { presentAuthProblem } from "@/lib/platform";
import {
  myPageAccountNavigation,
  myPageShortcutNavigation,
  myPageSupportNavigation,
} from "@/lib/routes/navigation";

export function MyPageTop() {
  const { logout, state } = useSession();
  const { showToast } = useToast();
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

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "unauthenticated" || state.status === "session-expired") return <LoginRequiredState />;
  if (state.status === "configuration-unavailable" || state.status === "error") return <ErrorState />;

  const user = state.session.user;
  if (!user) return <LoginRequiredState />;

  return (
    <div className="mypage-dashboard">
      <section aria-labelledby="member-summary-heading" className="mypage-summary">
        <div className="mypage-summary__heading">
          <span aria-hidden="true" className="mypage-summary__mark">LP</span>
          <div>
            <p>MEMBER ACCOUNT</p>
            <h2 id="member-summary-heading">会員メニュー</h2>
          </div>
        </div>
        <dl>
          <div><dt>メール認証</dt><dd>{user.email_verified ? "確認済み" : "未確認"}</dd></div>
          <div><dt>アカウント状態</dt><dd>{user.state === "active" ? "利用中" : "制限あり"}</dd></div>
        </dl>
      </section>

      <nav aria-label="会員ショートカット" className="mypage-shortcuts">
        {myPageShortcutNavigation.map((item) => (
          <Link href={item.href} key={item.href}>
            <span><small>{item.eyebrow}</small><strong>{item.label}</strong><em>{item.description}</em></span>
            <span aria-hidden="true" className="mypage-chevron">›</span>
          </Link>
        ))}
      </nav>

      <MenuSection items={myPageAccountNavigation} label="アカウント" />
      <MenuSection items={myPageSupportNavigation} label="お知らせ・サポート" />

      <button className="mypage-logout" disabled={loggingOut} onClick={handleLogout} type="button">
        {loggingOut ? "ログアウト中…" : "ログアウト"}
      </button>
    </div>
  );
}

function MenuSection({
  items,
  label,
}: {
  readonly items: readonly { readonly description: string; readonly href: string; readonly label: string }[];
  readonly label: string;
}) {
  return (
    <section className="mypage-menu">
      <h2>{label}</h2>
      <nav aria-label={label}>
        {items.map((item) => (
          item.href.startsWith("https://") ? (
            <a href={item.href} key={item.href} rel="noopener noreferrer" target="_blank">
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              <span aria-hidden="true" className="mypage-chevron">›</span>
            </a>
          ) : (
            <Link href={item.href} key={item.href}>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              <span aria-hidden="true" className="mypage-chevron">›</span>
            </Link>
          )
        ))}
      </nav>
    </section>
  );
}

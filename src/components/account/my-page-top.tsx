"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { SmsVerificationRequiredDialog } from "@/components/account/sms-verification-required-dialog";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState, LoginRequiredState } from "@/components/common/state-panel";
import { useToast } from "@/components/common/toast-provider";
import { presentAuthProblem, presentSmsProblem } from "@/lib/platform";
import {
  createMyPageSupportNavigation,
  myPageAccountNavigation,
  myPageShortcutNavigation,
  smsVerificationRoute,
} from "@/lib/routes/navigation";
import { consumeSmsRegistrationPrompt } from "@/lib/sms-registration-prompt";

export function MyPageTop({
  accountUpdated,
  contactHref,
}: {
  readonly accountUpdated?: "email" | "password";
  readonly contactHref?: string;
}) {
  const router = useRouter();
  const { getSmsVerificationStatus, logout, state } = useSession();
  const { showToast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const [addressGateOpen, setAddressGateOpen] = useState(false);
  const [checkingAddress, setCheckingAddress] = useState(false);
  const [registrationPromptOpen, setRegistrationPromptOpen] = useState(false);
  const successShown = useRef(false);
  const promptUser = useRef<string | null>(null);

  useEffect(() => {
    if (!accountUpdated || successShown.current) return;
    successShown.current = true;
    window.history.replaceState(window.history.state, "", "/mypage");
    showToast(
      accountUpdated === "email" ? "メールアドレス変更" : "パスワード変更",
      accountUpdated === "email" ? "メールアドレスを変更しました。" : "パスワードを変更しました。",
    );
  }, [accountUpdated, showToast]);

  useEffect(() => {
    const userId = state.status === "authenticated" ? state.session.user?.id : null;
    if (!userId || promptUser.current === userId) return;
    promptUser.current = userId;
    setRegistrationPromptOpen(consumeSmsRegistrationPrompt(userId));
  }, [state]);

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

  async function navigateFromAccount(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (href !== "/mypage/address" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (checkingAddress) return;
    setCheckingAddress(true);
    try {
      const sms = await getSmsVerificationStatus();
      if (sms.verified) {
        router.push(href);
      } else {
        setAddressGateOpen(true);
      }
    } catch (error) {
      showToast("お届け先を開けませんでした", presentSmsProblem(error).message);
    } finally {
      setCheckingAddress(false);
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
          <span aria-hidden="true" className="mypage-summary__mark">OZ</span>
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

      <MenuSection items={myPageAccountNavigation} label="アカウント" onNavigate={navigateFromAccount} />
      <MenuSection items={createMyPageSupportNavigation(contactHref)} label="お知らせ・サポート" />

      <button className="mypage-logout" disabled={loggingOut} onClick={handleLogout} type="button">
        {loggingOut ? "ログアウト中…" : "ログアウト"}
      </button>
      <ConfirmationDialog
        cancelLabel="あとで認証する"
        confirmLabel="SMS認証する"
        description="お届け先の登録や配送依頼を利用するには、携帯電話番号のSMS認証が必要です。"
        onCancel={() => setRegistrationPromptOpen(false)}
        onConfirm={() => router.push(smsVerificationRoute)}
        open={registrationPromptOpen}
        title="SMS認証のご案内"
      />
      <SmsVerificationRequiredDialog context="address" onCancel={() => setAddressGateOpen(false)} open={addressGateOpen} />
    </div>
  );
}

function MenuSection({
  items,
  label,
  onNavigate,
}: {
  readonly items: readonly { readonly description: string; readonly href: string; readonly label: string }[];
  readonly label: string;
  readonly onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
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
            <Link href={item.href} key={item.href} onClick={(event) => onNavigate?.(event, item.href)}>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              <span aria-hidden="true" className="mypage-chevron">›</span>
            </Link>
          )
        ))}
      </nav>
    </section>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect } from "react";
import { LoadingState } from "@/components/common/loading-state";
import { LoginRequiredState } from "@/components/common/state-panel";
import { requiresSmsVerification } from "@/lib/routes/navigation";
import { smsVerificationHref } from "@/lib/sms-return";
import { useSession } from "./session-provider";

export function MemberAccess({ children, redirect = false, loading = <LoadingState /> }: {
  readonly children: React.ReactNode;
  readonly redirect?: boolean;
  readonly loading?: React.ReactNode;
}) {
  const { state, smsAccess, refreshSession } = useSession();
  if (state.status === "unauthenticated" || state.status === "session-expired") return <LoginRequiredState />;
  if (state.status === "error" || state.status === "configuration-unavailable" || smsAccess === "error") {
    return <section className="verification-card" role="alert">
      <p>認証状態を確認できませんでした。もう一度お試しください。</p>
      <button className="button button--ghost" onClick={() => void refreshSession()} type="button">再試行</button>
    </section>;
  }
  if (state.status !== "authenticated" || smsAccess === "loading") return <>{loading}</>;
  if (smsAccess !== "verified") return <section className="verification-card">
    {redirect && <SmsRedirect />}
    <p>ご利用にはSMS認証が必要です。</p>
    <Link className="button button--dark" href={smsVerificationHref()}>SMS認証へ</Link>
  </section>;
  return <>{children}</>;
}

function SmsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace(smsVerificationHref()); }, [router]);
  return null;
}

export function MemberRouteAccess({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/points/purchase/")) return <>{children}</>;
  return requiresSmsVerification(pathname) ? <MemberAccess redirect>{children}</MemberAccess> : <>{children}</>;
}

export function SessionBoundContent({ children }: { readonly children: React.ReactNode }) {
  const { state, smsAccess } = useSession();
  const identity = state.status === "authenticated" ? `${state.session.user?.id}:${smsAccess}` : state.status;
  return <Fragment key={identity}>{children}</Fragment>;
}

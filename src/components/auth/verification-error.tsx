import Link from "next/link";
import { preRegisterLoginHref } from "@/lib/pre-register";

const EMAIL_VERIFICATION_GENERIC_ERROR_MESSAGE =
  "メール認証を完了できませんでした。認証リンクが無効または期限切れの可能性があります。";

export function EmailVerificationError({ code }: { readonly code?: string }) {
  const message = code === "EMAIL_ALREADY_CLAIMED"
    ? "このメールアドレスはすでに認証済みです。ログインしてご利用ください。"
    : EMAIL_VERIFICATION_GENERIC_ERROR_MESSAGE;

  return (
    <section className="verification-card verification-card--error">
      <span aria-hidden="true">!</span>
      <p>{message}</p>
      <Link className="button button--dark" href="/login">ログインする</Link>
      <Link href="/pre-register">事前登録のご案内へ</Link>
      <Link href={preRegisterLoginHref}>事前登録のお手続きを再開</Link>
      <p>認証メールの再送は、登録時の画面から行えます。メール認証がお済みの場合はログインして再開してください。</p>
    </section>
  );
}

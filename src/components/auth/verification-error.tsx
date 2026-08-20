import Link from "next/link";

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
      <Link href="/">トップへ戻る</Link>
    </section>
  );
}

"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import { EmailChangeCompletion, InvalidEmailChangeLink } from "./email-change";
import { InvalidPasswordResetLink, PasswordResetConfirmForm } from "./password-reset";

type IdentityLink =
  | { readonly kind: "email-change"; readonly requestId: string; readonly token: string; readonly valid: true }
  | { readonly kind: "email-change"; readonly valid: false }
  | { readonly kind: "password-reset"; readonly token: string; readonly userId: string; readonly valid: true }
  | { readonly kind: "password-reset"; readonly valid: false };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function AccountSecurityLinkRouter({
  expectedKind,
}: {
  readonly expectedKind: "email-change" | "password-reset";
}) {
  const consumedLink = useRef<IdentityLink | null>(null);
  const [link, setLink] = useState<IdentityLink | null>(null);

  useLayoutEffect(() => {
    let active = true;
    let parsedLink = consumedLink.current;
    if (!parsedLink) {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const emailRequestId = fragment.get("email_change_request_id");
      const passwordResetUserId = fragment.get("password_reset_user_id");
      const token = fragment.get("token");
      const kind = fragment.get("account_security");
      const safePath = expectedKind === "email-change" ? "/email-change/verify" : "/password-reset/confirm";

      if (expectedKind === "email-change") {
        parsedLink = emailRequestId && token && UUID_PATTERN.test(emailRequestId) && TOKEN_PATTERN.test(token)
          && kind === expectedKind
          ? { kind: expectedKind, requestId: emailRequestId, token, valid: true }
          : { kind: expectedKind, valid: false };
      } else {
        parsedLink = passwordResetUserId && token && UUID_PATTERN.test(passwordResetUserId) && TOKEN_PATTERN.test(token)
          && kind === expectedKind
          ? { kind: expectedKind, token, userId: passwordResetUserId, valid: true }
          : { kind: expectedKind, valid: false };
      }
      consumedLink.current = parsedLink;

      // Do not pass the current App Router history state: it can retain renderedSearch,
      // or the fragment token. The consumed entry does not need to be restorable.
      window.history.replaceState({ __NA: true }, "", safePath);
    }
    queueMicrotask(() => {
      if (active) setLink(parsedLink);
    });
    return () => { active = false; };
  }, [expectedKind]);

  if (!link) return <div aria-live="polite" className="loading-state" role="status">リンクを確認しています…</div>;
  const content = link.kind === "email-change"
    ? (link.valid
      ? <EmailChangeCompletion requestId={link.requestId} token={link.token} />
      : <InvalidEmailChangeLink />)
    : (link.valid
      ? <PasswordResetConfirmForm token={link.token} userId={link.userId} />
      : <InvalidPasswordResetLink />);
  const emailChange = link.kind === "email-change";
  return (
    <PageContainer className="route-page auth-page account-security-page" size="narrow">
      <PageTitle
        description={emailChange ? "確認リンクを処理しています。" : "新しいパスワードを入力してください。"}
        eyebrow={emailChange ? "EMAIL CHANGE" : "PASSWORD RESET"}
        title={emailChange ? "メールアドレス変更" : "パスワード再設定"}
      />
      {content}
    </PageContainer>
  );
}

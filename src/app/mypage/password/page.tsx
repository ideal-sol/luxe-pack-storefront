import Link from "next/link";
import { PasswordChangeForm } from "@/components/account-security/password-change";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function PasswordChangePage() {
  return (
    <PageContainer className="route-page auth-page account-security-page" size="narrow">
      <PageTitle description="現在のパスワードを確認し、新しいパスワードへ即時更新します。" eyebrow="MY PAGE / PASSWORD" title="パスワード変更" />
      <Link className="account-security-page__back" href="/mypage">← マイページへ戻る</Link>
      <PasswordChangeForm />
    </PageContainer>
  );
}

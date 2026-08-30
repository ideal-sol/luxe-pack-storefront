import { PasswordResetRequestForm } from "@/components/account-security/password-reset";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function PasswordResetPage() {
  return (
    <PageContainer className="route-page auth-page account-security-page" size="narrow">
      <PageTitle description="ご登録のメールアドレスへパスワード再設定用メールをお送りします。" eyebrow="PASSWORD RESET" title="パスワード再設定" />
      <PasswordResetRequestForm />
    </PageContainer>
  );
}

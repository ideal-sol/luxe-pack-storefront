import { RegisterForm } from "@/components/auth/register-form";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function RegisterPage() {
  return (
    <PageContainer className="route-page auth-page" size="narrow">
      <PageTitle description="メールアドレスを登録し、届いた認証メールから手続きを完了します。" eyebrow="JOIN OripaZ" title="新規登録" />
      <RegisterForm />
    </PageContainer>
  );
}

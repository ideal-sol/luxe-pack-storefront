import { LoginForm } from "@/components/auth/login-form";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function LoginPage() {
  return (
    <PageContainer className="route-page auth-page" size="narrow">
      <PageTitle description="登録済みのメールアドレスとパスワードでログインします。" eyebrow="WELCOME BACK" title="ログイン" />
      <LoginForm />
    </PageContainer>
  );
}

import { LoginForm } from "@/components/auth/login-form";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams?: Promise<{ readonly "password-updated"?: string | readonly string[] }>;
}) {
  const query = await searchParams;
  const passwordUpdated = query?.["password-updated"] === "1";
  return (
    <PageContainer className="route-page auth-page" size="narrow">
      <PageTitle description="登録済みのメールアドレスとパスワードでログインします。" eyebrow="WELCOME BACK" title="ログイン" />
      <LoginForm passwordUpdated={passwordUpdated} />
    </PageContainer>
  );
}

import { EmailVerificationNotice } from "@/components/auth/verification";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default async function VerifyEmailPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly user_id?: string }>;
}) {
  const { user_id: userId } = await searchParams;
  return (
    <PageContainer className="route-page auth-page" size="narrow">
      <PageTitle description="認証メールに記載されたリンクからメールアドレスを確認します。" eyebrow="EMAIL VERIFICATION" title="メール認証" />
      <EmailVerificationNotice {...(userId ? { userId } : {})} />
    </PageContainer>
  );
}

import { EmailVerificationCompletion } from "@/components/auth/verification";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default async function CompleteEmailVerificationPage({
  params,
}: {
  readonly params: Promise<{ readonly hash: string; readonly userId: string }>;
}) {
  const { hash, userId } = await params;
  return (
    <PageContainer className="route-page" size="narrow">
      <PageTitle description="認証リンクを確認しています。" eyebrow="EMAIL VERIFICATION" title="メール認証" />
      <EmailVerificationCompletion hash={hash} userId={userId} />
    </PageContainer>
  );
}

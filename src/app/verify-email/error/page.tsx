import { EmailVerificationError } from "@/components/auth/verification-error";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

interface VerifyEmailErrorPageProps {
  readonly searchParams: Promise<{
    readonly code?: string | readonly string[];
  }>;
}

export default async function VerifyEmailErrorPage({ searchParams }: VerifyEmailErrorPageProps) {
  const { code } = await searchParams;

  return (
    <PageContainer className="route-page auth-page" size="narrow">
      <PageTitle eyebrow="EMAIL VERIFICATION" title="メール認証に失敗しました" />
      <EmailVerificationError {...(typeof code === "string" ? { code } : {})} />
    </PageContainer>
  );
}

import Link from "next/link";
import { EmailChangeRequestForm } from "@/components/account-security/email-change";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function EmailChangePage() {
  return (
    <PageContainer className="route-page auth-page account-security-page" size="narrow">
      <PageTitle description="新しいメールアドレスへ確認メールをお送りします。" eyebrow="MY PAGE / EMAIL" title="メールアドレス変更" />
      <Link className="account-security-page__back" href="/mypage">← マイページへ戻る</Link>
      <EmailChangeRequestForm />
    </PageContainer>
  );
}

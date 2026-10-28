import Link from "next/link";
import { AccountClosureGuide } from "@/components/account/account-closure-guide";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function AccountClosurePage() {
  return (
    <PageContainer className="route-page auth-page account-security-page account-closure-page" size="narrow">
      <PageTitle description="退会の前に、失われる内容をご確認ください。" eyebrow="MY PAGE / ACCOUNT" title="退会（アカウントの削除）" />
      <Link className="account-security-page__back" href="/mypage">← マイページへ戻る</Link>
      <AccountClosureGuide />
    </PageContainer>
  );
}

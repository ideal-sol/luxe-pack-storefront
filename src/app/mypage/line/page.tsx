import { ExternalIdentityClientProvider } from "@/components/account/external-identity-client-provider";
import { LineAccountLink } from "@/components/account/line-account-link";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function LineConnectionPage() {
  return (
    <PageContainer className="route-page mypage-page" size="narrow">
      <PageTitle description="LINEアカウントとの連携状態を確認できます。" eyebrow="MY PAGE / CONNECTION" title="LINE連携" />
      <ExternalIdentityClientProvider>
        <LineAccountLink />
      </ExternalIdentityClientProvider>
    </PageContainer>
  );
}

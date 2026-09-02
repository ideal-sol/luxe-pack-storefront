import { SmsVerification } from "@/components/account/sms-verification";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function SmsVerificationPage() {
  return (
    <PageContainer className="route-page mypage-page sms-verification-page" size="narrow">
      <PageTitle description="携帯電話番号の所有をSMSで確認します。" eyebrow="MY PAGE / SMS" title="SMS認証" />
      <SmsVerification />
    </PageContainer>
  );
}

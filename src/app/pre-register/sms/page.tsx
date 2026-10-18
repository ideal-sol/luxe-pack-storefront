import { PageContainer } from "@/components/layout/page-container";
import { PreRegisterAccount } from "@/components/pre-register/pre-register-account";

export default function PreRegisterSmsPage() {
  return <PageContainer className="route-page mypage-page sms-verification-page pre-register-page" size="narrow">
    <PreRegisterAccount screen="sms" />
  </PageContainer>;
}

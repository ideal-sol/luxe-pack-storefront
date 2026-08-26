import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import { PaymentClientProvider } from "@/components/payment/payment-client-provider";
import { PaymentHistoryPage } from "@/components/payment/payment-history-page";

export default function PurchasesPage() {
  return (
    <PageContainer className="route-page payment-history-page" size="narrow">
      <PageTitle description="購入済みとお支払い可能なコイン購入を確認できます。" eyebrow="MY PAGE / PURCHASES" title="購入履歴" />
      <PaymentClientProvider><PaymentHistoryPage /></PaymentClientProvider>
    </PageContainer>
  );
}

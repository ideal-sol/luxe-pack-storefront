import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { PaymentClientProvider } from "@/components/payment/payment-client-provider";
import { PaymentHistoryDetail } from "@/components/payment/payment-history-detail";

export default async function PurchaseDetailPage({ params }: { readonly params: Promise<{ readonly paymentId: string }> }) {
  const { paymentId } = await params;
  return (
    <PageContainer className="route-page payment-history-detail-page" size="narrow">
      <Link className="payment-history-detail__back" href="/mypage/purchases">＜ 購入履歴</Link>
      <PaymentClientProvider><PaymentHistoryDetail paymentId={paymentId} /></PaymentClientProvider>
    </PageContainer>
  );
}

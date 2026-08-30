import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { PaymentClientProvider } from "@/components/payment/payment-client-provider";
import { PointPurchaseDetail } from "@/components/points/point-purchase-detail";

export default async function PointPurchaseDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly productId: string }>;
  readonly searchParams?: Promise<{
    readonly card_registration_id?: string | readonly string[];
    readonly pid?: string | readonly string[];
  }>;
}) {
  const { productId } = await params;
  const query = await searchParams;
  const registrationId = typeof query?.card_registration_id === "string"
    ? query.card_registration_id
    : null;
  const pid = !registrationId && typeof query?.pid === "string" ? query.pid : null;
  return (
    <PageContainer className="route-page point-purchase-detail-page" size="narrow">
      <Link className="point-purchase-detail__back" href="/points">← コイン購入へ戻る</Link>
      <PaymentClientProvider>
        <PointPurchaseDetail pid={pid} productId={productId} registrationId={registrationId} />
      </PaymentClientProvider>
    </PageContainer>
  );
}

import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { PointPurchaseDetail } from "@/components/points/point-purchase-detail";

export default async function PointPurchaseDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly productId: string }>;
}) {
  const { productId } = await params;
  return (
    <PageContainer className="route-page point-purchase-detail-page" size="narrow">
      <Link className="point-purchase-detail__back" href="/points">← コイン購入へ戻る</Link>
      <PointPurchaseDetail productId={productId} />
    </PageContainer>
  );
}

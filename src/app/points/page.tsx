import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import { PointPurchasePage } from "@/components/points/point-purchase-page";

export default function PointsPage() {
  return (
    <PageContainer className="route-page points-page" size="narrow">
      <PageTitle eyebrow="POINTS" title="ポイント購入" />
      <PointPurchasePage />
    </PageContainer>
  );
}

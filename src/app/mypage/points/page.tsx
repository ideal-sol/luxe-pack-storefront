import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import { PointHistoryPage } from "@/components/points/point-history-page";

export default function MyPointsPage() {
  return (
    <PageContainer className="route-page points-page" size="narrow">
      <PageTitle eyebrow="MY PAGE / POINTS" title="ポイント履歴" />
      <PointHistoryPage />
    </PageContainer>
  );
}

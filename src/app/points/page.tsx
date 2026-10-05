import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import { PointPurchasePage } from "@/components/points/point-purchase-page";
import { FirstBuyPointsLayout } from "@/components/points/first-buy-layout-preview";
import { readFirstBuyLayoutState, type FirstBuyLayoutState } from "@/lib/presentation/first-buy-layout";

type PointsPageProps = { readonly searchParams?: Promise<{ readonly first_buy?: string | readonly string[] }> };
function PointsContent({ state = null }: { readonly state?: FirstBuyLayoutState | null }) {
  return (
    <PageContainer className="route-page points-page" size="narrow">
      <PageTitle eyebrow="COINS" title="コイン購入" />
      {state ? <FirstBuyPointsLayout key={state} state={state} /> : <PointPurchasePage />}
    </PageContainer>
  );
}
async function PointsLayoutPreview({ searchParams }: PointsPageProps) {
  const query = await searchParams;
  return <PointsContent state={readFirstBuyLayoutState(query?.first_buy, true)} />;
}
export default function PointsPage(props: PointsPageProps = {}) {
  return process.env.STOREFRONT_FIRST_BUY_LAYOUT_PREVIEW === "1" ? <PointsLayoutPreview {...props} /> : <PointsContent />;
}

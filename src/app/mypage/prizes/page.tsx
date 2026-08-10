import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import { PrizeClientProvider } from "@/components/prizes/prize-client-provider";
import { PrizeInventory } from "@/components/prizes/prize-inventory";

export default function PrizesPage() {
  return (
    <PageContainer className="route-page inventory-page">
      <PageTitle description="獲得した景品の状態を確認し、Platformが許可した景品だけを選択できます。" eyebrow="MY PAGE / ITEMS" title="獲得アイテム" />
      <PrizeClientProvider>
        <PrizeInventory />
      </PrizeClientProvider>
    </PageContainer>
  );
}

import { PageTitle } from "@/components/common/page-title";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import { DrawHistoryPage as DrawHistory } from "@/components/draw/draw-history-page";
import { PageContainer } from "@/components/layout/page-container";

export default function DrawHistoryPage() {
  return (
    <PageContainer className="route-page draw-history-page" size="narrow">
      <PageTitle
        description="利用したガチャとPlatformが確定した実行内容を確認できます。"
        eyebrow="MY PAGE / HISTORY"
        title="ガチャ履歴"
      />
      <DrawClientProvider>
        <DrawHistory />
      </DrawClientProvider>
    </PageContainer>
  );
}

import { GachaDetailView } from "@/components/catalog/gacha-detail";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";

export default async function GachaDetailPage({ params }: { readonly params: Promise<{ readonly slug: string }> }) {
  const { slug } = await params;
  return (
    <PageContainer className="gacha-detail-page" size="narrow">
      <PageTitle description="引く前に、封入されている景品をご覧いただけます。" eyebrow="PACK DETAIL" headingAs="p" title="ガチャ詳細" />
      <DrawClientProvider>
        <GachaDetailView slug={slug} />
      </DrawClientProvider>
    </PageContainer>
  );
}

import { GachaDetailView } from "@/components/catalog/gacha-detail";
import { PageContainer } from "@/components/layout/page-container";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";

export default async function GachaDetailPage({ params }: { readonly params: Promise<{ readonly slug: string }> }) {
  const { slug } = await params;
  return (
    <PageContainer className="gacha-detail-page" size="narrow">
      <DrawClientProvider>
        <GachaDetailView slug={slug} />
      </DrawClientProvider>
    </PageContainer>
  );
}

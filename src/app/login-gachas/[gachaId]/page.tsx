import { LoginGachaDetailView } from "@/components/catalog/login-gacha-detail";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";

export default async function LoginGachaPage({ params }: { readonly params: Promise<{ readonly gachaId: string }> }) {
  const { gachaId } = await params;
  return <PageContainer className="gacha-detail-page" size="narrow">
    <PageTitle eyebrow="PACK DETAIL" headingAs="p" title="ガチャ詳細" />
    <DrawClientProvider><LoginGachaDetailView gachaId={gachaId} /></DrawClientProvider>
  </PageContainer>;
}

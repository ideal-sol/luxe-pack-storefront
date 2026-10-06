import { GachaPrizeRateView } from "@/components/catalog/gacha-prize-rate";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default async function GachaPrizeRatePage({ params }: { readonly params: Promise<{ readonly slug: string }> }) {
  const { slug } = await params;
  return (
    <PageContainer className="route-page prize-rate-page" size="narrow">
      <PageTitle description="賞ごとの封入数と提供割合をご覧いただけます。" eyebrow="PRIZE RATE" title="提供割合" />
      <GachaPrizeRateView slug={slug} />
    </PageContainer>
  );
}

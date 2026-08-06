import { GachaCatalog } from "@/components/catalog/gacha-catalog";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default async function GachasPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly category?: string }>;
}) {
  const { category } = await searchParams;
  return (
    <PageContainer className="route-page catalog-page">
      <PageTitle description="公開中のラインナップをカテゴリーから探せます。販売判断はPlatformの公開Contractをそのまま表示します。" eyebrow="PACK CATALOG" title="ガチャを探す" />
      <GachaCatalog {...(category ? { initialCategory: category } : {})} key={category ?? "all"} />
    </PageContainer>
  );
}

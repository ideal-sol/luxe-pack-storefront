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
      <PageTitle description="販売中の企画をすべてご覧いただけます。" eyebrow="PACK CATALOG" title="ガチャ一覧" />
      <GachaCatalog {...(category ? { initialCategory: category } : {})} key={category ?? "all"} />
    </PageContainer>
  );
}

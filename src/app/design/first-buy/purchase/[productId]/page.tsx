import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { FirstBuyDetailLayout } from "@/components/points/first-buy-layout-preview";
import { firstBuyLayoutDeals, readFirstBuyLayoutState } from "@/lib/presentation/first-buy-layout";

export const metadata = { robots: { index: false, follow: false } };
export default async function FirstBuyDetailPreview({ params, searchParams }: {
  readonly params: Promise<{ readonly productId: string }>;
  readonly searchParams?: Promise<{ readonly first_buy?: string | readonly string[] }>;
}) {
  const { productId } = await params;
  const query = await searchParams;
  const state = readFirstBuyLayoutState(query?.first_buy, process.env.STOREFRONT_FIRST_BUY_LAYOUT_PREVIEW === "1");
  if (!state || !firstBuyLayoutDeals.some(deal => deal.product.id === productId)) notFound();
  return <PageContainer className="route-page point-purchase-detail-page" size="narrow"><FirstBuyDetailLayout state={state} productId={productId} /></PageContainer>;
}

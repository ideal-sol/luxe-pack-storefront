import { HomeFirstBuy } from "@/components/points/first-buy-home";
import { FirstBuyLayoutNotice } from "@/components/points/first-buy-layout-preview";
import { firstBuyLayoutOffer, readFirstBuyLayoutState } from "@/lib/presentation/first-buy-layout";
import type { Metadata } from "next";
import { HomeAssist } from "@/components/catalog/home-assist";
import { HomeHero } from "@/components/catalog/home-hero";
import { PublicHome } from "@/components/catalog/public-home";
import { CardRegistrationReturnRouter } from "@/components/payment/card-registration-return-router";

export const metadata: Metadata = { referrer: "no-referrer" };

export default async function HomePage({
  searchParams,
}: {
  readonly searchParams?: Promise<{
    readonly first_buy?: string | readonly string[];
    readonly popup?: string | readonly string[];
    readonly card_registration_id?: string | readonly string[];
  }>;
}) {
  const query = await searchParams;
  const registrationId = typeof query?.card_registration_id === "string"
    ? query.card_registration_id
    : null;
  if (registrationId) return <CardRegistrationReturnRouter registrationId={registrationId} />;
  const layoutState = readFirstBuyLayoutState(query?.first_buy, process.env.STOREFRONT_FIRST_BUY_LAYOUT_PREVIEW === "1");
  return (
    <>
      <HomeHero />
      {layoutState && <HomeFirstBuy key={`${layoutState}-${query?.popup === "1"}`} offer={firstBuyLayoutOffer(layoutState)} showPopup={query?.popup === "1"} />}
      {layoutState && <FirstBuyLayoutNotice path="/" state={layoutState} />}
      <PublicHome />
      <HomeAssist />
    </>
  );
}

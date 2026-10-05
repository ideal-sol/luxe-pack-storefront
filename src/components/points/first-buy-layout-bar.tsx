"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { firstBuyLayoutOffer, readFirstBuyLayoutState } from "@/lib/presentation/first-buy-layout";
import { FirstBuyBar } from "./first-buy-offer";
export function FirstBuyLayoutBar() {
  const path = usePathname();
  const query = useSearchParams();
  const state = readFirstBuyLayoutState(query.get("first_buy"), true);
  return state && (path === "/" || path === "/points") ? <FirstBuyBar offer={firstBuyLayoutOffer(state)} /> : null;
}

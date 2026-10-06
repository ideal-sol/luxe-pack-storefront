"use client";

import { usePathname } from "next/navigation";
import { HomeFirstBuy } from "./first-buy-home";
import { FirstBuyBar } from "./first-buy-offer";
import { useFirstBuyOffer } from "./use-first-buy-offer";

export function ConnectedFirstBuyHome() {
  const offer = useFirstBuyOffer();
  return offer ? <HomeFirstBuy offer={offer} showPopup /> : null;
}

export function ConnectedFirstBuyBar() {
  const path = usePathname();
  const offer = useFirstBuyOffer();
  return offer && (path === "/" || path === "/points") ? <FirstBuyBar offer={offer} /> : null;
}

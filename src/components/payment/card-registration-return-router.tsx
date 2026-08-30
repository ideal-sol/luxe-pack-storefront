"use client";

import { useEffect } from "react";
import { CatalogLoading } from "@/components/catalog/catalog-message";
import { pointPurchaseCardRegistrationReturnRoute } from "@/lib/routes/navigation";
import { readCardRegistrationResume } from "./card-registration-resume";

export function CardRegistrationReturnRouter({ registrationId }: { readonly registrationId: string }) {
  useEffect(() => {
    let target = "/points";
    try {
      const context = readCardRegistrationResume();
      if (context?.phase === "awaiting_return" && context.registrationId === registrationId) {
        target = pointPurchaseCardRegistrationReturnRoute(context.productId, registrationId);
      }
    } catch {
    }
    window.location.replace(target);
  }, [registrationId]);

  return <CatalogLoading label="カード保存結果を確認中" />;
}

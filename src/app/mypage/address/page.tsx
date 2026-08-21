import Link from "next/link";
import { ShippingAddressManager } from "@/components/address/shipping-address-manager";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import { PrizeClientProvider } from "@/components/prizes/prize-client-provider";

export default function ShippingAddressPage() {
  return (
    <PageContainer className="route-page mypage-page shipping-address-page" size="narrow">
      <PageTitle description="景品をお届けする住所の登録・編集・削除ができます。" eyebrow="MY PAGE / ADDRESS" title="お届け先登録" />
      <Link className="shipping-address-page__back" href="/mypage">← マイページへ戻る</Link>
      <PrizeClientProvider>
        <ShippingAddressManager />
      </PrizeClientProvider>
    </PageContainer>
  );
}

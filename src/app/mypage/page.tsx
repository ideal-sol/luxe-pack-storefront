import { MyPageTop } from "@/components/account/my-page-top";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function MyPage() {
  return (
    <PageContainer className="route-page mypage-page" size="narrow">
      <PageTitle description="会員向けの履歴、獲得景品、アカウント情報へ移動できます。" eyebrow="MY PAGE" title="マイページ" />
      <MyPageTop />
    </PageContainer>
  );
}

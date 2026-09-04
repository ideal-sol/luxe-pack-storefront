import { MyPageTop } from "@/components/account/my-page-top";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default async function MyPage({
  searchParams,
}: {
  readonly searchParams?: Promise<{ readonly "account-updated"?: string | readonly string[] }>;
}) {
  const query = await searchParams;
  const accountUpdated = query?.["account-updated"] === "email" || query?.["account-updated"] === "password"
    ? query["account-updated"]
    : undefined;
  const contactHref = process.env.APP_CONTACT?.trim() || undefined;
  return (
    <PageContainer className="route-page mypage-page" size="narrow">
      <PageTitle description="会員向けの履歴、獲得景品、アカウント情報へ移動できます。" eyebrow="MY PAGE" title="マイページ" />
      <MyPageTop {...(accountUpdated ? { accountUpdated } : {})} {...(contactHref ? { contactHref } : {})} />
    </PageContainer>
  );
}

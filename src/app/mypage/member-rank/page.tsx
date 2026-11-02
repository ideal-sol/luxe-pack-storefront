import type { Metadata } from "next";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import { MemberRankPage } from "@/components/member-rank/member-rank-page";

export const metadata: Metadata = { title: "会員ランク" };

export default function MyMemberRankPage() {
  return (
    <PageContainer className="route-page member-rank-page">
      <PageTitle
        description="現在の会員ランク、今月のランクポイントと特典をご確認いただけます。"
        eyebrow="MY PAGE / MEMBER RANK"
        title="会員ランク"
      />
      <MemberRankPage />
    </PageContainer>
  );
}

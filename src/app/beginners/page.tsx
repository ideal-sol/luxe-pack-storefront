import type { Metadata } from "next";
import { BeginnersGuide } from "@/components/catalog/beginners-guide";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = { title: "はじめての方へ" };

export default function BeginnersPage() {
  return (
    <PageContainer className="route-page beginners-page">
      <PageTitle description="オリポケのご利用方法と、お約束していることをまとめています。" eyebrow="BEGINNERS GUIDE" title="はじめての方へ" />
      <BeginnersGuide />
    </PageContainer>
  );
}

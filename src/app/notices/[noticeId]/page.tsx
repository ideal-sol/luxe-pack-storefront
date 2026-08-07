import { NoticeDetail } from "@/components/content/notice-detail";
import { PageContainer } from "@/components/layout/page-container";

export default async function NoticeDetailPage({ params }: { readonly params: Promise<{ noticeId: string }> }) {
  const { noticeId } = await params;
  return (
    <section className="route-page content-route">
      <PageContainer size="narrow"><NoticeDetail noticeId={noticeId} /></PageContainer>
    </section>
  );
}

import { NoticeList } from "@/components/content/notice-list";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function NoticesPage() {
  return (
    <section className="route-page content-route">
      <PageContainer size="narrow">
        <PageTitle description="Luxe Packからの最新情報をご案内します。" eyebrow="INFORMATION" title="お知らせ" />
        <NoticeList />
      </PageContainer>
    </section>
  );
}

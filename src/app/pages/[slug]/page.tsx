import { StaticPage } from "@/components/content/static-page";
import { PageContainer } from "@/components/layout/page-container";

export default async function ContentPage({ params }: { readonly params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <section className="route-page content-route">
      <PageContainer size="narrow"><StaticPage slug={slug} /></PageContainer>
    </section>
  );
}

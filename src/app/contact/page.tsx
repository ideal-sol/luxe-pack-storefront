import { ContactClientProvider } from "@/components/contact/contact-client-provider";
import { ContactAccessBoundary } from "@/components/contact/contact-access-boundary";
import { ContactForm } from "@/components/contact/contact-form";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function ContactPage() {
  return (
    <PageContainer className="route-page contact-page" size="narrow">
      <PageTitle
        description="商品やサービスについてのお問い合わせを受け付けています。"
        eyebrow="CONTACT"
        title="お問い合わせ"
      />
      <ContactAccessBoundary>
        <ContactClientProvider>
          <ContactForm />
        </ContactClientProvider>
      </ContactAccessBoundary>
    </PageContainer>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { LoadingState } from "@/components/common/loading-state";
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
      {/* B-2: マイページ等から開いたときに、トップへ戻れるようにする */}
      <Link className="account-security-page__back contact-page__home-link" href="/">← {process.env.NEXT_PUBLIC_APP_NAME?.trim() || "オリポケ"}のトップへ戻る</Link>
      <Suspense fallback={<LoadingState />}>
        <ContactAccessBoundary>
          <ContactClientProvider>
            <ContactForm />
          </ContactClientProvider>
        </ContactAccessBoundary>
      </Suspense>
    </PageContainer>
  );
}

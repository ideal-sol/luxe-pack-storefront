import { PageContainer } from "@/components/layout/page-container";
import { PaymentClientProvider } from "@/components/payment/payment-client-provider";
import { PaymentThanks } from "@/components/payment/payment-thanks";

export default async function PaymentThanksPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly pid?: string | readonly string[] }>;
}) {
  const parameters = await searchParams;
  const pid = typeof parameters.pid === "string" ? parameters.pid : null;
  return (
    <PageContainer className="route-page payment-thanks-page" size="narrow">
      <PaymentClientProvider>
        <PaymentThanks pid={pid} />
      </PaymentClientProvider>
    </PageContainer>
  );
}

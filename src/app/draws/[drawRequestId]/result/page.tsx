import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import { DrawResultView } from "@/components/draw/draw-result";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default async function DrawResultPage({
  params,
}: {
  readonly params: Promise<{ readonly drawRequestId: string }>;
}) {
  const { drawRequestId } = await params;
  return (
    <PageContainer className="draw-result-page" size="narrow">
      <PageTitle description="当選景品と利用できるお手続きをご確認いただけます。" eyebrow="RESULT" headingAs="p" title="抽選結果" />
      <DrawClientProvider>
        <DrawResultView drawRequestId={drawRequestId} />
      </DrawClientProvider>
    </PageContainer>
  );
}

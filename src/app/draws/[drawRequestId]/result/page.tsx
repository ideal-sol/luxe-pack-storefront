import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import { DrawResultView } from "@/components/draw/draw-result";
import { PageContainer } from "@/components/layout/page-container";

export default async function DrawResultPage({
  params,
}: {
  readonly params: Promise<{ readonly drawRequestId: string }>;
}) {
  const { drawRequestId } = await params;
  return (
    <PageContainer className="draw-result-page" size="narrow">
      <DrawClientProvider>
        <DrawResultView drawRequestId={drawRequestId} />
      </DrawClientProvider>
    </PageContainer>
  );
}

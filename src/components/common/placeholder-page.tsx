import { EmptyState, LoginRequiredState } from "@/components/common/state-panel";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

interface PlaceholderPageProps {
  readonly description: string;
  readonly eyebrow: string;
  readonly loginRequired?: boolean;
  readonly title: string;
}

export function PlaceholderPage({
  description,
  eyebrow,
  loginRequired = false,
  title,
}: PlaceholderPageProps) {
  return (
    <PageContainer className="route-page" size="narrow">
      <PageTitle description={description} eyebrow={eyebrow} title={title} />
      {loginRequired ? <LoginRequiredState /> : <EmptyState />}
    </PageContainer>
  );
}

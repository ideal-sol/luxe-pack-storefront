"use client";

import { useSession } from "@/components/auth/session-provider";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState, ErrorState, LoginRequiredState } from "@/components/common/state-panel";
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
  const { state } = useSession();

  let content = <EmptyState />;
  if (loginRequired) {
    if (state.status === "loading") content = <LoadingState />;
    else if (state.status === "unauthenticated" || state.status === "session-expired") content = <LoginRequiredState />;
    else if (state.status === "configuration-unavailable" || state.status === "error") content = <ErrorState />;
  }

  return (
    <PageContainer className="route-page" size="narrow">
      <PageTitle description={description} eyebrow={eyebrow} title={title} />
      {content}
    </PageContainer>
  );
}

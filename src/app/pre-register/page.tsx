import { PageContainer } from "@/components/layout/page-container";
import { PreRegisterFlow } from "@/components/pre-register/pre-register-flow";
import { pendingRegistrationId } from "@/lib/pre-register";

export default async function PreRegisterPage({ searchParams }: {
  readonly searchParams: Promise<{ readonly user_id?: string | readonly string[] }>;
}) {
  const query = await searchParams;
  return (
    <PageContainer className="route-page auth-page pre-register-page" size="narrow">
      <PreRegisterFlow initialPendingUserId={pendingRegistrationId(query.user_id)} />
    </PageContainer>
  );
}

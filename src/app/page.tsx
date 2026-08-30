import { PublicHome } from "@/components/catalog/public-home";
import { CardRegistrationReturnRouter } from "@/components/payment/card-registration-return-router";

export default async function HomePage({
  searchParams,
}: {
  readonly searchParams?: Promise<{ readonly card_registration_id?: string | readonly string[] }>;
}) {
  const query = await searchParams;
  const registrationId = typeof query?.card_registration_id === "string"
    ? query.card_registration_id
    : null;
  if (registrationId) return <CardRegistrationReturnRouter registrationId={registrationId} />;
  return <PublicHome />;
}

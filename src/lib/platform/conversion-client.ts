import { ApiProblemError, createStorefrontIdentityClient, type StorefrontTransport } from "@oripa/storefront-client";
import type { LineFriendConversionApi } from "@/lib/analytics/line-friend-conversion";
import { createBrowserPlatformTransport } from "./browser-client";

/** Preserve the official Client's Session, CSRF, SMS and Problem boundaries. */
export function createConversionAdapter(transport: StorefrontTransport): LineFriendConversionApi {
  const client = createStorefrontIdentityClient(transport);
  return {
    pending: async () => (await client.getPendingConversionEvents()).data.data,
    claim: async (id) => {
      try {
        const { data: { data } } = await client.claimConversionEvent(id);
        return { token: data.claim_token, expiresInSeconds: data.expires_in_seconds };
      } catch (error) {
        if (error instanceof ApiProblemError) {
          if (error.status === 404 && error.code === "CONVERSION_NOT_FOUND") return "not_found";
          if (error.status === 409) {
            if (error.code === "CONVERSION_CLAIM_HELD") return "held";
            if (error.code === "CONVERSION_ALREADY_DELIVERED") return "already_delivered";
            if (error.code === "CONVERSION_NOT_DELIVERABLE") return "not_deliverable";
          }
        }
        throw error;
      }
    },
    delivered: async (id, token) => {
      try {
        await client.deliverConversionEvent(id, { claim_token: token });
        return "delivered";
      } catch (error) {
        if (error instanceof ApiProblemError) {
          if (error.status === 409 && error.code === "CONVERSION_TOKEN_MISMATCH") return "token_mismatch";
          if (error.status === 404 && error.code === "CONVERSION_NOT_FOUND") return "not_found";
        }
        throw error;
      }
    },
  };
}

export function createBrowserConversionClient(): LineFriendConversionApi {
  return createConversionAdapter(createBrowserPlatformTransport());
}

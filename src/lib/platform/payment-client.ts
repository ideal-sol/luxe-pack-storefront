import {
  createCsrfManagedStorefrontPaymentClient,
  createIdempotencyKey,
} from "@oripa/storefront-client";
import type {
  BrowserStorefrontPaymentClient,
  PaymentHistoryQuery,
  PublicComponents,
  StorefrontTransport,
} from "@oripa/storefront-client";
import { createBrowserPlatformTransport, type BrowserClientOverrides } from "./browser-client";
import type { PlatformRuntimeConfiguration } from "./runtime-configuration";
import type { PaymentUiGateway } from "./payment-ui-gateway";

type Schemas = PublicComponents["schemas"];

export type Payment = Schemas["Payment"] & { readonly method_label?: string };
export type PaymentCollection = Schemas["PaymentCollection"];
export type PaymentCard = Schemas["PaymentCard"];
export type PaymentCardCollection = Schemas["PaymentCardCollection"];
export type PaymentCardComponentAction = Schemas["PaymentCardComponentAction"];
export type PaymentCardRegistration = Schemas["PaymentCardRegistration"];
export type PaymentCardRegistrationAction = Schemas["PaymentCardRegistrationAction"];
export type PaymentCardRegistrationStatus = Schemas["PaymentCardRegistrationStatus"];
export type PaymentCardUiBootstrap = Schemas["PaymentCardUiBootstrap"];
export type PaymentCreateRequest = Schemas["PaymentCreateRequest"];
export type PaymentMethod = Schemas["PaymentMethod"];
export type PaymentRedirectAction = Schemas["PaymentRedirectAction"];
export type PaymentResume = Schemas["PaymentResume"];
export type PaymentStatus = Schemas["PaymentStatus"];

type PaymentPurchaseClientAdapter = Pick<
  BrowserStorefrontPaymentClient,
  | "cancelCardRegistration"
  | "deleteCard"
  | "getCardRegistration"
  | "getPayment"
  | "getPaymentCardUiBootstrap"
  | "listCards"
  | "reconcileCardRegistration"
  | "resumeUnpaidPayment"
  | "startCardRegistration"
  | "startPayment"
>;

export type PaymentClientAdapter = PaymentPurchaseClientAdapter & Partial<Pick<BrowserStorefrontPaymentClient, "listPayments">> & {
  listPaymentMethods?: PaymentUiGateway["listPaymentMethods"];
};

export function createPaymentClientAdapter(transport: StorefrontTransport): PaymentClientAdapter {
  const client = createCsrfManagedStorefrontPaymentClient(transport);
  // alpha.46-only compatibility. A later Client adoption must explicitly wire
  // the full PaymentUiGateway; never silently fall back when listing exists.
  if ("listPaymentMethods" in client) throw new Error("Payment UI Client integration is required");
  return {
    cancelCardRegistration: client.cancelCardRegistration,
    deleteCard: client.deleteCard,
    getCardRegistration: client.getCardRegistration,
    getPayment: client.getPayment,
    getPaymentCardUiBootstrap: client.getPaymentCardUiBootstrap,
    listCards: client.listCards,
    listPayments: client.listPayments,
    reconcileCardRegistration: client.reconcileCardRegistration,
    resumeUnpaidPayment: client.resumeUnpaidPayment,
    startCardRegistration: client.startCardRegistration,
    startPayment: client.startPayment,
  };
}

export function createBrowserPaymentClient(
  configuration?: PlatformRuntimeConfiguration,
  overrides: BrowserClientOverrides = {},
): PaymentClientAdapter {
  return createPaymentClientAdapter(createBrowserPlatformTransport(configuration, overrides));
}

export { createIdempotencyKey };
export type { PaymentHistoryQuery };

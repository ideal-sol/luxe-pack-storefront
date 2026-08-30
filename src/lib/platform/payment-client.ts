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

type Schemas = PublicComponents["schemas"];

export type Payment = Schemas["Payment"];
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

export type PaymentClientAdapter = PaymentPurchaseClientAdapter & Partial<Pick<BrowserStorefrontPaymentClient, "listPayments">>;

export function createPaymentClientAdapter(transport: StorefrontTransport): PaymentClientAdapter {
  const client = createCsrfManagedStorefrontPaymentClient(transport);
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

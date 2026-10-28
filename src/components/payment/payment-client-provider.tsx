"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { PaymentUiGateway } from "@/lib/platform/payment-ui-gateway";
import { browserPaymentProviderSdk, type PaymentProviderSdk } from "./provider-payment-sdk";
import {
  createBrowserPaymentClient,
  PlatformConfigurationError,
  type PaymentClientAdapter,
} from "@/lib/platform";

interface PaymentClientContextValue {
  readonly client: PaymentClientAdapter | null;
  readonly uiGateway: PaymentUiGateway | null;
  readonly providerSdk: PaymentProviderSdk;
}

const PaymentClientContext = createContext<PaymentClientContextValue | null>(null);

function resolveClient(injected: PaymentClientAdapter | null | undefined) {
  if (injected !== undefined) return injected;
  return createBrowserPaymentClient();
}

export function PaymentClientProvider({
  children,
  client: injectedClient,
  uiGateway: injectedGateway,
  providerSdk = browserPaymentProviderSdk,
}: {
  readonly children: React.ReactNode;
  readonly client?: PaymentClientAdapter | null;
  readonly uiGateway?: PaymentUiGateway | null;
  readonly providerSdk?: PaymentProviderSdk;
}) {
  const [client] = useState<PaymentClientAdapter | null>(() => {
    try {
      return resolveClient(injectedClient);
    } catch (error) {
      if (error instanceof PlatformConfigurationError) return null;
      throw error;
    }
  });
  const uiGateway = injectedGateway === undefined ? client?.uiGateway ?? null : injectedGateway;
  const value = useMemo(() => ({ client, uiGateway, providerSdk }), [client, uiGateway, providerSdk]);
  return <PaymentClientContext.Provider value={value}>{children}</PaymentClientContext.Provider>;
}

export function usePaymentClient() {
  const context = useContext(PaymentClientContext);
  if (!context) throw new Error("usePaymentClient must be used within PaymentClientProvider");
  return context;
}

"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  createBrowserPaymentClient,
  PlatformConfigurationError,
  type PaymentClientAdapter,
} from "@/lib/platform";

interface PaymentClientContextValue {
  readonly client: PaymentClientAdapter | null;
}

const PaymentClientContext = createContext<PaymentClientContextValue | null>(null);

function resolveClient(injected: PaymentClientAdapter | null | undefined) {
  if (injected !== undefined) return injected;
  return createBrowserPaymentClient();
}

export function PaymentClientProvider({
  children,
  client: injectedClient,
}: {
  readonly children: React.ReactNode;
  readonly client?: PaymentClientAdapter | null;
}) {
  const [client] = useState<PaymentClientAdapter | null>(() => {
    try {
      return resolveClient(injectedClient);
    } catch (error) {
      if (error instanceof PlatformConfigurationError) return null;
      throw error;
    }
  });
  const value = useMemo(() => ({ client }), [client]);
  return <PaymentClientContext.Provider value={value}>{children}</PaymentClientContext.Provider>;
}

export function usePaymentClient() {
  const context = useContext(PaymentClientContext);
  if (!context) throw new Error("usePaymentClient must be used within PaymentClientProvider");
  return context;
}

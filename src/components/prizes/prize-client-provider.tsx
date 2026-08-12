"use client";

import { createContext, useContext, useState } from "react";
import {
  createBrowserPrizeInventoryClient,
  PlatformConfigurationError,
  type PrizeFulfillmentAdapter,
} from "@/lib/platform";

interface PrizeClientContextValue {
  readonly client: PrizeFulfillmentAdapter | null;
  readonly configurationAvailable: boolean;
}

const PrizeClientContext = createContext<PrizeClientContextValue | null>(null);

function resolveClient(injected: PrizeFulfillmentAdapter | null | undefined) {
  if (injected !== undefined) return injected;
  return createBrowserPrizeInventoryClient();
}

export function PrizeClientProvider({
  children,
  client: injectedClient,
}: {
  readonly children: React.ReactNode;
  readonly client?: PrizeFulfillmentAdapter | null;
}) {
  const [client] = useState<PrizeFulfillmentAdapter | null>(() => {
    try {
      return resolveClient(injectedClient);
    } catch (error) {
      if (error instanceof PlatformConfigurationError) return null;
      throw error;
    }
  });

  return (
    <PrizeClientContext.Provider value={{ client, configurationAvailable: client !== null }}>
      {children}
    </PrizeClientContext.Provider>
  );
}

export function usePrizeClient() {
  const context = useContext(PrizeClientContext);
  if (!context) throw new Error("usePrizeClient must be used within PrizeClientProvider");
  return context;
}

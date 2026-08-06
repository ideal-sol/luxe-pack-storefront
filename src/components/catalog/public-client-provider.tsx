"use client";

import { createContext, useContext, useState } from "react";
import {
  createBrowserPublicClient,
  PlatformConfigurationError,
  type PublicCatalogAdapter,
} from "@/lib/platform";

interface PublicClientContextValue {
  readonly client: PublicCatalogAdapter | null;
  readonly configurationAvailable: boolean;
}

const PublicClientContext = createContext<PublicClientContextValue | null>(null);

function resolveClient(injected: PublicCatalogAdapter | null | undefined) {
  if (injected !== undefined) return injected;
  return createBrowserPublicClient();
}

export function PublicClientProvider({
  children,
  client: injectedClient,
}: {
  readonly children: React.ReactNode;
  readonly client?: PublicCatalogAdapter | null;
}) {
  const [client] = useState<PublicCatalogAdapter | null>(() => {
    try {
      return resolveClient(injectedClient);
    } catch (error) {
      if (error instanceof PlatformConfigurationError) return null;
      throw error;
    }
  });

  return (
    <PublicClientContext.Provider value={{ client, configurationAvailable: client !== null }}>
      {children}
    </PublicClientContext.Provider>
  );
}

export function usePublicClient() {
  const context = useContext(PublicClientContext);
  if (!context) throw new Error("usePublicClient must be used within PublicClientProvider");
  return context;
}

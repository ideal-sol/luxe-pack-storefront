"use client";

import { createContext, useContext, useState } from "react";
import {
  createBrowserExternalIdentityClient,
  PlatformConfigurationError,
  type ExternalIdentityAdapter,
} from "@/lib/platform";

interface ExternalIdentityClientContextValue {
  readonly client: ExternalIdentityAdapter | null;
  readonly configurationAvailable: boolean;
}

const ExternalIdentityClientContext = createContext<ExternalIdentityClientContextValue | null>(null);

function resolveClient(injected: ExternalIdentityAdapter | null | undefined) {
  if (injected !== undefined) return injected;
  return createBrowserExternalIdentityClient();
}

export function ExternalIdentityClientProvider({
  children,
  client: injectedClient,
}: {
  readonly children: React.ReactNode;
  readonly client?: ExternalIdentityAdapter | null;
}) {
  const [client] = useState<ExternalIdentityAdapter | null>(() => {
    try {
      return resolveClient(injectedClient);
    } catch (error) {
      if (error instanceof PlatformConfigurationError) return null;
      throw error;
    }
  });

  return (
    <ExternalIdentityClientContext.Provider value={{ client, configurationAvailable: client !== null }}>
      {children}
    </ExternalIdentityClientContext.Provider>
  );
}

export function useExternalIdentityClient() {
  const context = useContext(ExternalIdentityClientContext);
  if (!context) throw new Error("useExternalIdentityClient must be used within ExternalIdentityClientProvider");
  return context;
}

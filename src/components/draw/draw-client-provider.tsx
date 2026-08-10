"use client";

import { createContext, useContext, useState } from "react";
import {
  createBrowserDrawClient,
  PlatformConfigurationError,
  type DrawClientAdapter,
} from "@/lib/platform";

interface DrawClientContextValue {
  readonly client: DrawClientAdapter | null;
  readonly configurationAvailable: boolean;
}

const DrawClientContext = createContext<DrawClientContextValue | null>(null);

function resolveClient(injected: DrawClientAdapter | null | undefined) {
  if (injected !== undefined) return injected;
  return createBrowserDrawClient();
}

export function DrawClientProvider({
  children,
  client: injectedClient,
}: {
  readonly children: React.ReactNode;
  readonly client?: DrawClientAdapter | null;
}) {
  const [client] = useState<DrawClientAdapter | null>(() => {
    try {
      return resolveClient(injectedClient);
    } catch (error) {
      if (error instanceof PlatformConfigurationError) return null;
      throw error;
    }
  });

  return (
    <DrawClientContext.Provider value={{ client, configurationAvailable: client !== null }}>
      {children}
    </DrawClientContext.Provider>
  );
}

export function useDrawClient() {
  const context = useContext(DrawClientContext);
  if (!context) throw new Error("useDrawClient must be used within DrawClientProvider");
  return context;
}

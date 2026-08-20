"use client";

import { createContext, useContext, useState } from "react";
import {
  createBrowserContactClient,
  PlatformConfigurationError,
  type ContactClientAdapter,
} from "@/lib/platform";

interface ContactClientContextValue {
  readonly client: ContactClientAdapter | null;
  readonly configurationAvailable: boolean;
}

const ContactClientContext = createContext<ContactClientContextValue | null>(null);

function resolveClient(injected: ContactClientAdapter | null | undefined) {
  if (injected !== undefined) return injected;
  return createBrowserContactClient();
}

export function ContactClientProvider({
  children,
  client: injectedClient,
}: {
  readonly children: React.ReactNode;
  readonly client?: ContactClientAdapter | null;
}) {
  const [client] = useState<ContactClientAdapter | null>(() => {
    try {
      return resolveClient(injectedClient);
    } catch (error) {
      if (error instanceof PlatformConfigurationError) return null;
      throw error;
    }
  });

  return (
    <ContactClientContext.Provider value={{ client, configurationAvailable: client !== null }}>
      {children}
    </ContactClientContext.Provider>
  );
}

export function useContactClient() {
  const context = useContext(ContactClientContext);
  if (!context) throw new Error("useContactClient must be used within ContactClientProvider");
  return context;
}

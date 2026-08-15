"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import {
  createBrowserPointClient,
  PlatformConfigurationError,
  presentPlatformProblem,
  type PlatformProblemPresentation,
  type PointClientAdapter,
  type PointWalletBalance,
} from "@/lib/platform";

export type PointWalletState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly balance: PointWalletBalance }
  | { readonly status: "unauthenticated" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "session-error" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation };

interface PointClientContextValue {
  readonly client: PointClientAdapter | null;
  readonly wallet: PointWalletState;
}

type WalletReadState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly balance: PointWalletBalance; readonly sessionUserId: string }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation; readonly sessionUserId: string };

const PointClientContext = createContext<PointClientContextValue | null>(null);

function resolveClient(injected: PointClientAdapter | null | undefined) {
  if (injected !== undefined) return injected;
  return createBrowserPointClient();
}

export function PointClientProvider({
  children,
  client: injectedClient,
}: {
  readonly children: React.ReactNode;
  readonly client?: PointClientAdapter | null;
}) {
  const { state: session } = useSession();
  const [client] = useState<PointClientAdapter | null>(() => {
    try {
      return resolveClient(injectedClient);
    } catch (error) {
      if (error instanceof PlatformConfigurationError) return null;
      throw error;
    }
  });
  const [walletRead, setWalletRead] = useState<WalletReadState>({ status: "loading" });
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  useEffect(() => {
    if (!client || !sessionUserId) return;
    let active = true;
    void client.getWallet()
      .then(({ data }) => {
        if (active) setWalletRead({ balance: data, sessionUserId, status: "ready" });
      })
      .catch((error: unknown) => {
        if (active) setWalletRead({ problem: presentPlatformProblem(error), sessionUserId, status: "error" });
      });
    return () => { active = false; };
  }, [client, sessionUserId]);

  const wallet = useMemo<PointWalletState>(() => !client || session.status === "configuration-unavailable"
    ? { status: "configuration-unavailable" }
    : session.status === "unauthenticated" || session.status === "session-expired"
      ? { status: "unauthenticated" }
      : session.status === "error"
        ? { status: "session-error" }
        : session.status === "authenticated" && walletRead.status !== "loading" && walletRead.sessionUserId === sessionUserId
          ? walletRead.status === "ready"
            ? { balance: walletRead.balance, status: "ready" }
            : { problem: walletRead.problem, status: "error" }
          : { status: "loading" }, [client, session.status, sessionUserId, walletRead]);

  const value = useMemo<PointClientContextValue>(() => ({
    client,
    wallet,
  }), [client, wallet]);

  return <PointClientContext.Provider value={value}>{children}</PointClientContext.Provider>;
}

export function usePointClient() {
  const context = useContext(PointClientContext);
  if (!context) throw new Error("usePointClient must be used within PointClientProvider");
  return context;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  readonly refreshWallet: () => Promise<void>;
  readonly wallet: PointWalletState;
}

type WalletReadState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly balance: PointWalletBalance; readonly sessionUserId: string }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation; readonly sessionUserId: string };

const PointClientContext = createContext<PointClientContextValue | null>(null);
const WALLET_POLLING_INTERVAL_MS = 60_000;
const PASSIVE_REFRESH_DEDUPE_MS = 250;
const WALLET_REFRESH_EVENT = "storefront:wallet-refresh";

type WalletRefreshOrigin = "manual" | "passive";

interface WalletRefreshRequest {
  readonly id: symbol;
  readonly origin: WalletRefreshOrigin;
  readonly promise: Promise<void>;
  readonly sessionUserId: string;
}

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
  const inFlightRef = useRef<WalletRefreshRequest | null>(null);
  const trailingManualRef = useRef<WalletRefreshRequest | null>(null);
  const lastPassiveRefreshAtRef = useRef(Number.NEGATIVE_INFINITY);
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;
  const sessionUserIdRef = useRef(sessionUserId);

  useEffect(() => {
    sessionUserIdRef.current = sessionUserId;
  }, [sessionUserId]);

  const startWalletRead = useCallback((origin: WalletRefreshOrigin) => {
    if (!client || !sessionUserId) return Promise.resolve();
    const sequence = ++requestSequenceRef.current;
    const id = Symbol("wallet-refresh");
    const promise = client.getWallet()
      .then(({ data }) => {
        if (!mountedRef.current || sequence !== requestSequenceRef.current || sessionUserIdRef.current !== sessionUserId) return;
        setWalletRead({ balance: data, sessionUserId, status: "ready" });
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || sequence !== requestSequenceRef.current || sessionUserIdRef.current !== sessionUserId) return;
        const problem = presentPlatformProblem(error);
        setWalletRead((current) => current.status === "ready" && current.sessionUserId === sessionUserId
          ? current
          : { problem, sessionUserId, status: "error" });
      })
      .finally(() => {
        if (inFlightRef.current?.id === id) inFlightRef.current = null;
      });
    const request = { id, origin, promise, sessionUserId };
    inFlightRef.current = request;
    return promise;
  }, [client, sessionUserId]);

  const refreshWallet = useCallback(() => {
    if (!client || !sessionUserId) return Promise.resolve();
    const inFlight = inFlightRef.current;
    if (!inFlight || inFlight.sessionUserId !== sessionUserId) return startWalletRead("manual");
    if (inFlight.origin === "manual") return inFlight.promise;
    const queued = trailingManualRef.current;
    if (queued?.sessionUserId === sessionUserId) return queued.promise;
    const id = Symbol("wallet-refresh-trailing");
    const promise = inFlight.promise
      .then(() => sessionUserIdRef.current === sessionUserId ? startWalletRead("manual") : undefined)
      .finally(() => {
        if (trailingManualRef.current?.id === id) trailingManualRef.current = null;
      });
    const request = { id, origin: "manual" as const, promise, sessionUserId };
    trailingManualRef.current = request;
    return promise;
  }, [client, sessionUserId, startWalletRead]);

  const refreshWalletPassively = useCallback(() => {
    if (!client || !sessionUserId) return Promise.resolve();
    const inFlight = inFlightRef.current;
    if (inFlight?.sessionUserId === sessionUserId) return inFlight.promise;
    const queued = trailingManualRef.current;
    if (queued?.sessionUserId === sessionUserId) return queued.promise;
    return startWalletRead("passive");
  }, [client, sessionUserId, startWalletRead]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!client || !sessionUserId) {
      requestSequenceRef.current += 1;
      return;
    }
    void refreshWalletPassively();
  }, [client, refreshWalletPassively, sessionUserId]);

  useEffect(() => {
    if (!client || !sessionUserId) return;
    const handleWalletRefresh = () => void refreshWallet();
    document.addEventListener(WALLET_REFRESH_EVENT, handleWalletRefresh);
    return () => document.removeEventListener(WALLET_REFRESH_EVENT, handleWalletRefresh);
  }, [client, refreshWallet, sessionUserId]);

  useEffect(() => {
    if (!client || !sessionUserId) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const startPolling = () => {
      stopPolling();
      if (document.visibilityState !== "visible") return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void refreshWalletPassively();
      }, WALLET_POLLING_INTERVAL_MS);
    };
    const refreshAfterForeground = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastPassiveRefreshAtRef.current < PASSIVE_REFRESH_DEDUPE_MS) return;
      lastPassiveRefreshAtRef.current = now;
      void refreshWalletPassively();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        stopPolling();
        return;
      }
      refreshAfterForeground();
      startPolling();
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refreshAfterForeground);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", refreshAfterForeground);
    };
  }, [client, refreshWalletPassively, sessionUserId]);

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
    refreshWallet,
    wallet,
  }), [client, refreshWallet, wallet]);

  return <PointClientContext.Provider value={value}>{children}</PointClientContext.Provider>;
}

export const WALLET_REFRESH_POLICY = {
  passiveDedupeMs: PASSIVE_REFRESH_DEDUPE_MS,
  pollingIntervalMs: WALLET_POLLING_INTERVAL_MS,
} as const;

export function usePointClient() {
  const context = useContext(PointClientContext);
  if (!context) throw new Error("usePointClient must be used within PointClientProvider");
  return context;
}

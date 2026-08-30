"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isAuthProblemError } from "@oripa/storefront-client";
import {
  createBrowserAuthClient,
  PlatformConfigurationError,
  type AuthClientAdapter,
  type AuthSession,
  type EmailChangeCompleteRequest,
  type EmailChangeCompleted,
  type EmailChangePending,
  type EmailChangeRequest,
  type LoginRequest,
  type PendingRegistration,
  type PasswordChangeRequest,
  type PasswordChanged,
  type PasswordResetAccepted,
  type PasswordResetCompleted,
  type PasswordResetConfirmRequest,
  type PasswordResetRequest,
  type RegistrationRequest,
  type VerificationResendRequest,
} from "@/lib/platform";

export type SessionState =
  | { readonly status: "loading" }
  | { readonly status: "authenticated"; readonly session: AuthSession }
  | { readonly status: "unauthenticated"; readonly session: AuthSession }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "session-expired" }
  | { readonly status: "error" };

function sessionState(data: AuthSession): SessionState {
  return data.authenticated && data.user
    ? { status: "authenticated", session: data }
    : { status: "unauthenticated", session: data };
}

interface SessionContextValue {
  readonly changePassword: (input: PasswordChangeRequest) => Promise<PasswordChanged>;
  readonly completeEmailChange: (input: EmailChangeCompleteRequest) => Promise<EmailChangeCompleted>;
  readonly completeEmailVerification: (input: { readonly user_id: string; readonly hash: string }) => Promise<void>;
  readonly confirmPasswordReset: (input: PasswordResetConfirmRequest) => Promise<PasswordResetCompleted>;
  readonly createEmailChangeRequest: (input: EmailChangeRequest) => Promise<EmailChangePending>;
  readonly login: (input: LoginRequest) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly refreshSession: () => Promise<void>;
  readonly register: (input: RegistrationRequest) => Promise<PendingRegistration>;
  readonly requestPasswordReset: (input: PasswordResetRequest) => Promise<PasswordResetAccepted>;
  readonly resendEmailVerification: (input: VerificationResendRequest) => Promise<void>;
  readonly state: SessionState;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function resolveClient(injected: AuthClientAdapter | null | undefined) {
  if (injected !== undefined) return injected;
  return createBrowserAuthClient();
}

export function SessionProvider({
  children,
  client: injectedClient,
}: {
  readonly children: React.ReactNode;
  readonly client?: AuthClientAdapter | null;
}) {
  const [client] = useState<AuthClientAdapter | null>(() => {
    try {
      return resolveClient(injectedClient);
    } catch (error) {
      if (error instanceof PlatformConfigurationError) return null;
      throw error;
    }
  });
  const [state, setState] = useState<SessionState>(
    client ? { status: "loading" } : { status: "configuration-unavailable" },
  );
  const refreshSequence = useRef(0);

  const requireClient = useCallback(() => {
    if (!client) throw new PlatformConfigurationError();
    return client;
  }, [client]);

  const refreshSession = useCallback(async () => {
    if (!client) {
      setState({ status: "configuration-unavailable" });
      return;
    }
    const sequence = ++refreshSequence.current;
    setState({ status: "loading" });
    try {
      const { data } = await client.getCurrentSession();
      if (sequence !== refreshSequence.current) return;
      setState(sessionState(data));
    } catch (error) {
      if (sequence !== refreshSequence.current) return;
      setState(
        isAuthProblemError(error, "SESSION_EXPIRED")
          ? { status: "session-expired" }
          : { status: "error" },
      );
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const sequence = ++refreshSequence.current;
    void client.getCurrentSession()
      .then(({ data }) => {
        if (sequence === refreshSequence.current) setState(sessionState(data));
      })
      .catch((error: unknown) => {
        if (sequence !== refreshSequence.current) return;
        setState(
          isAuthProblemError(error, "SESSION_EXPIRED")
            ? { status: "session-expired" }
            : { status: "error" },
        );
      });
  }, [client]);

  const value = useMemo<SessionContextValue>(() => ({
    async changePassword(input) {
      const { data } = await requireClient().changeUserPassword(input, {});
      await refreshSession();
      return data;
    },
    async completeEmailChange(input) {
      const { data } = await requireClient().completeEmailChange(input, {});
      if (data.authenticated) {
        await refreshSession();
      } else {
        refreshSequence.current += 1;
        setState({
          status: "unauthenticated",
          session: { authenticated: false, user: null },
        });
      }
      return data;
    },
    async completeEmailVerification(input) {
      await requireClient().completeEmailVerification(input);
      await refreshSession();
    },
    async confirmPasswordReset(input) {
      const { data } = await requireClient().confirmPasswordReset(input, {});
      refreshSequence.current += 1;
      setState(sessionState({ authenticated: data.authenticated, user: data.user }));
      return data;
    },
    async createEmailChangeRequest(input) {
      const { data } = await requireClient().createEmailChangeRequest(input, {});
      return data;
    },
    async login(input) {
      await requireClient().login(input);
      await refreshSession();
    },
    async logout() {
      await requireClient().logout();
      refreshSequence.current += 1;
      setState({
        status: "unauthenticated",
        session: { authenticated: false, user: null },
      });
    },
    refreshSession,
    async register(input) {
      const { data } = await requireClient().register(input);
      await refreshSession();
      return data;
    },
    async requestPasswordReset(input) {
      const { data } = await requireClient().requestPasswordReset(input, {});
      return data;
    },
    async resendEmailVerification(input) {
      await requireClient().resendEmailVerification(input);
    },
    state,
  }), [refreshSession, requireClient, state]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}

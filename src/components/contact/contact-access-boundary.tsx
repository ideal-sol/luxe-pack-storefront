"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/auth/session-provider";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/state-panel";

export function ContactAccessBoundary({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const query = useSearchParams().toString();
  const returnTo = `/contact${query ? `?${query}` : ""}`;
  const { state } = useSession();
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  const userId = state.status === "authenticated"
    ? state.session.user?.id ?? null
    : state.status === "loading" || state.status === "error" ? lastUserId : null;
  if (userId !== lastUserId) setLastUserId(userId);

  useEffect(() => {
    if (state.status === "unauthenticated" || state.status === "session-expired") {
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [router, state.status, returnTo]);

  const loading = state.status === "loading"
    || state.status === "unauthenticated" || state.status === "session-expired";
  const error = state.status === "configuration-unavailable" || state.status === "error";

  return (
    <>
      {loading && <LoadingState />}
      {error && <ErrorState />}
      {/* Preserve edits during refresh; discard them when the authenticated User changes. */}
      <div hidden={state.status !== "authenticated"}>
        {userId && <Fragment key={userId}>{children}</Fragment>}
      </div>
    </>
  );
}

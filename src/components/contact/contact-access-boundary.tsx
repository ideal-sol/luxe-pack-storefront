"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/auth/session-provider";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/state-panel";

export function ContactAccessBoundary({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === "unauthenticated" || state.status === "session-expired") {
      router.replace("/login");
    }
  }, [router, state.status]);

  if (
    state.status === "loading"
    || state.status === "unauthenticated"
    || state.status === "session-expired"
  ) {
    return <LoadingState />;
  }
  if (state.status === "configuration-unavailable" || state.status === "error") {
    return <ErrorState />;
  }

  return children;
}

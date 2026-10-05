"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import type { PointProductCollection } from "@/lib/platform";
import { firstBuyRemainingMilliseconds, presentFirstBuyOffer } from "@/lib/presentation/first-buy-offer";
import { usePointClient } from "./point-client-provider";

export function useFirstBuyCountdown(collection: PointProductCollection | null, refresh: () => void) {
  const [elapsed, setElapsed] = useState<{ readonly asOf: string; readonly milliseconds: number } | null>(null);
  const asOf = collection?.first_user_offer?.as_of;
  const duration = collection ? firstBuyRemainingMilliseconds(collection) : 0;
  const active = collection?.first_user_offer?.state === "active";
  useEffect(() => {
    if (!active || !asOf) return;
    const started = performance.now();
    let refreshed = false;
    const tick = () => {
      const milliseconds = performance.now() - started;
      setElapsed({ asOf, milliseconds });
      if (milliseconds >= duration && !refreshed) {
        refreshed = true;
        refresh();
      }
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [active, asOf, duration, refresh]);
  return collection ? presentFirstBuyOffer(collection, Math.max(0, duration - (elapsed && elapsed.asOf === asOf ? elapsed.milliseconds : 0))) : null;
}

export function useFirstBuyOffer() {
  const { state: session } = useSession();
  const { client } = usePointClient();
  const sessionKey = session.status === "authenticated" ? session.session.user?.id
    : session.status === "unauthenticated" || session.status === "session-expired" ? "anonymous" : null;
  const [read, setRead] = useState<{ readonly key: string; readonly collection: PointProductCollection } | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!client || !sessionKey) return;
    let active = true;
    void client.listPointProducts()
      .then(({ data }) => { if (active) setRead({ key: sessionKey, collection: data }); })
      .catch(() => { if (active) setRead(null); });
    return () => { active = false; };
  }, [client, sessionKey, revision]);
  return useFirstBuyCountdown(read && read.key === sessionKey ? read.collection : null, refresh);
}

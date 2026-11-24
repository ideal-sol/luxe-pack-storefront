import { gtmContainerId, hashEmail, pushDataLayerEvent, withConversionLock } from "./gtm";

type ConversionRecord = { id: string; event: "line_friend_added" };
type Claim = { token: string; expiresInSeconds: number }
  | "held" | "already_delivered" | "not_deliverable" | "not_found";

/** Adapter boundary for the approved Platform Client. Transport errors reject. */
export interface LineFriendConversionApi {
  pending(): Promise<readonly ConversionRecord[]>;
  claim(id: string): Promise<Claim>;
  delivered(id: string, token: string): Promise<"delivered" | "token_mismatch" | "not_found">;
}

type Marker = { state: "pushed"; token: string; pushedAt: number }
  | { state: "delivered"; pushedAt: number };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern = /^[a-f0-9]{64}$/;

function read(key: string): Marker | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "null");
    if (!value || !Number.isSafeInteger(value.pushedAt) || value.pushedAt <= 0) return null;
    if (value.state === "delivered") return { state: "delivered", pushedAt: value.pushedAt };
    if (value.state === "pushed" && typeof value.token === "string" && tokenPattern.test(value.token)) {
      return { state: "pushed", token: value.token, pushedAt: value.pushedAt };
    }
  } catch { /* A blocked or malformed browser marker does not stop delivery. */ }
  return null;
}

function save(key: string, marker: Marker): void {
  try { window.localStorage.setItem(key, JSON.stringify(marker)); }
  catch { /* Keep trying delivered even if storage is unavailable. */ }
}

async function deliver(api: LineFriendConversionApi, id: string, key: string, marker: Extract<Marker, { state: "pushed" }>, active: () => boolean) {
  if (!active()) return;
  const result = await api.delivered(id, marker.token);
  if (result === "delivered") save(key, { state: "delivered", pushedAt: marker.pushedAt });
  return result;
}

async function recover(api: LineFriendConversionApi, id: string, key: string, marker: Extract<Marker, { state: "pushed" }>, active: () => boolean) {
  if (await deliver(api, id, key, marker, active) !== "token_mismatch" || !active()) return;
  const claim = await api.claim(id);
  if (!active()) return;
  if (claim === "already_delivered") {
    save(key, { state: "delivered", pushedAt: marker.pushedAt });
  } else if (typeof claim === "object" && tokenPattern.test(claim.token)) {
    const renewed = { ...marker, token: claim.token };
    save(key, renewed);
    await deliver(api, id, key, renewed, active);
  }
}

export function createLineFriendConversionRun() {
  let started = false;
  return async (api: LineFriendConversionApi, session: {
    userId: string;
    email?: string | null;
    smsVerified: boolean;
    isActive: () => boolean;
  } | null): Promise<void> => {
    if (started || typeof window === "undefined" || !gtmContainerId()
      || !session?.smsVerified || !uuid.test(session.userId) || !session.isActive()) return;
    started = true;
    const active = () => Boolean(gtmContainerId()) && session.isActive();
    try {
      for (const { id, event } of await api.pending()) {
        if (!active()) return;
        if (event !== "line_friend_added" || !uuid.test(id)) continue;
        const hash = await hashEmail(id.toLowerCase());
        if (!hash || !active()) return;
        const key = "oripoke:cv:conversion:" + hash;
        await withConversionLock(key, async () => {
          if (!active()) return;
          const existing = read(key);
          if (existing?.state === "delivered") return;
          if (existing?.state === "pushed") return recover(api, id, key, existing, active);

          const t0 = performance.now();
          const claim = await api.claim(id);
          if (!active() || typeof claim !== "object" || !tokenPattern.test(claim.token)
            || !Number.isInteger(claim.expiresInSeconds)
            || claim.expiresInSeconds <= 30 || claim.expiresInSeconds > 120) return;
          const deadline = t0 + (claim.expiresInSeconds - 30) * 1000;
          const current = read(key);
          if (current?.state === "delivered") return;
          if (current?.state === "pushed") {
            const marker = { ...current, token: claim.token };
            save(key, marker);
            await deliver(api, id, key, marker, active);
            return;
          }
          const email = await hashEmail(session.email);
          if (!active() || performance.now() >= deadline) return;
          if (!pushDataLayerEvent({ event: "line_friend_added", user_id: session.userId, user_email: email })) return;
          const marker: Marker = { state: "pushed", token: claim.token, pushedAt: Date.now() };
          save(key, marker);
          await deliver(api, id, key, marker, active);
        }, undefined);
      }
    } catch { /* Analytics errors end this page's attempt without affecting the UI. */ }
  };
}

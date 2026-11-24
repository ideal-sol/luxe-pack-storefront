import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLineFriendConversionRun, type LineFriendConversionApi } from "@/lib/analytics/line-friend-conversion";
import { pushDataLayerEvent } from "@/lib/analytics/gtm";

const userId = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
const token = "a".repeat(64);
const renewed = "b".repeat(64);
const records = [{ id, event: "line_friend_added" as const }];
const session = { userId, email: " Member@Example.TEST ", smsVerified: true, isActive: () => true };

function api() {
  return {
    pending: vi.fn<LineFriendConversionApi["pending"]>().mockResolvedValue(records),
    claim: vi.fn<LineFriendConversionApi["claim"]>().mockResolvedValue({ token, expiresInSeconds: 120 }),
    delivered: vi.fn<LineFriendConversionApi["delivered"]>().mockResolvedValue("delivered"),
  };
}

describe("LINE friend conversion", () => {
  let events: unknown[];
  beforeEach(() => {
    events = [];
    Object.defineProperty(window, "dataLayer", { configurable: true, writable: true, value: events });
    window.localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST0001");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("claims before pushing and delivers after pushing once per document", async () => {
    const client = api();
    client.claim.mockImplementation(async () => {
      expect(events).toEqual([]);
      return { token, expiresInSeconds: 120 };
    });
    client.delivered.mockImplementation(async () => {
      expect(events).toEqual([{ event: "line_friend_added", user_id: userId, user_email: expect.stringMatching(/^[0-9a-f]{64}$/) }]);
      return "delivered";
    });
    const run = createLineFriendConversionRun();
    await run(client, session);
    await run(client, session);
    expect(client.pending).toHaveBeenCalledTimes(1);
    expect(client.claim).toHaveBeenCalledExactlyOnceWith(id);
    expect(client.delivered).toHaveBeenCalledExactlyOnceWith(id, token);
  });

  it("does not spend the document's attempt before authentication, SMS verification and GTM are ready", async () => {
    const client = api();
    const run = createLineFriendConversionRun();
    await run(client, null);
    await run(client, { ...session, smsVerified: false });
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
    await run(client, session);
    expect(client.pending).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST0001");
    client.pending.mockResolvedValue([]);
    await run(client, session);
    expect(client.pending).toHaveBeenCalledTimes(1);
    expect(client.claim).not.toHaveBeenCalled();
    expect(client.delivered).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it.each(["held", "not_found", "already_delivered", "not_deliverable"] as const)("does not push after claim returns %s", async result => {
    const client = api();
    client.claim.mockResolvedValue(result);
    await createLineFriendConversionRun()(client, session);
    expect(events).toEqual([]);
    expect(client.delivered).not.toHaveBeenCalled();
  });

  it("honors the deadline from before the request and the 30 second margin", async () => {
    const client = api();
    const clock = vi.spyOn(performance, "now").mockReturnValue(100);
    client.claim.mockImplementation(async () => {
      clock.mockReturnValue(90_100);
      return { token, expiresInSeconds: 120 };
    });
    await createLineFriendConversionRun()(client, session);
    expect(events).toEqual([]);
    expect(client.delivered).not.toHaveBeenCalled();
  });

  it("stops after session invalidation during an outstanding claim", async () => {
    const client = api();
    let active = true;
    client.claim.mockImplementation(async () => {
      active = false;
      return { token, expiresInSeconds: 120 };
    });
    await createLineFriendConversionRun()(client, { ...session, isActive: () => active });
    expect(events).toEqual([]);
    expect(client.delivered).not.toHaveBeenCalled();
  });

  it.each([false, true])("retries after a rejected push (throws=%s)", async throws => {
    const client = api();
    if (throws) vi.spyOn(events, "push").mockImplementationOnce(() => { throw Error("test"); });
    else Object.defineProperty(window, "dataLayer", { configurable: true, value: {} });
    await createLineFriendConversionRun()(client, session);
    expect(window.localStorage.length).toBe(0);
    expect(client.delivered).not.toHaveBeenCalled();
    Object.defineProperty(window, "dataLayer", { configurable: true, value: events });
    await createLineFriendConversionRun()(client, session);
    expect(events).toHaveLength(1);
    expect(client.delivered).toHaveBeenCalledExactlyOnceWith(id, token);
  });

  it("sends delivered even when localStorage fails", async () => {
    const client = api();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("test"); });
    await createLineFriendConversionRun()(client, session);
    client.pending.mockResolvedValue([]);
    await createLineFriendConversionRun()(client, session);
    expect(events).toHaveLength(1);
    expect(client.delivered).toHaveBeenCalledExactlyOnceWith(id, token);
  });

  it("recovers a stale token, saves its replacement before confirmation, and does not push again", async () => {
    const client = api();
    client.delivered.mockRejectedValueOnce(Error("offline")).mockResolvedValueOnce("token_mismatch")
      .mockRejectedValueOnce(Error("offline"));
    client.claim.mockResolvedValueOnce({ token, expiresInSeconds: 120 })
      .mockResolvedValueOnce({ token: renewed, expiresInSeconds: 120 });
    await createLineFriendConversionRun()(client, session);
    await createLineFriendConversionRun()(client, session);
    await createLineFriendConversionRun()(client, session);
    await createLineFriendConversionRun()(client, session);
    expect(events).toHaveLength(1);
    expect(client.claim).toHaveBeenCalledTimes(2);
    expect(client.delivered.mock.calls).toEqual([[id, token], [id, token], [id, renewed], [id, renewed]]);
  });

  it("skips a concurrent tab while the record's Web Lock is held", async () => {
    let locked = false;
    vi.stubGlobal("navigator", { locks: { request: async (_key: string, options: { ifAvailable: boolean }, action: (lock: object | null) => Promise<void>) => {
      expect(options.ifAvailable).toBe(true);
      if (locked) return action(null);
      locked = true;
      try { await action({}); } finally { locked = false; }
    } } });
    const owner = api();
    const concurrent = api();
    let entered!: () => void;
    const claiming = new Promise<void>(resolve => { entered = resolve; });
    let resolveClaim!: (value: { token: string; expiresInSeconds: number }) => void;
    owner.claim.mockImplementation(() => new Promise(resolve => { resolveClaim = resolve; entered(); }));
    const first = createLineFriendConversionRun()(owner, session);
    await claiming;
    await createLineFriendConversionRun()(concurrent, session);
    expect(concurrent.claim).not.toHaveBeenCalled();
    resolveClaim({ token, expiresInSeconds: 120 });
    await first;
    expect(events).toHaveLength(1);
  });

  it("omits invalid identity fields and extra payment properties from the LINE payload", () => {
    expect(pushDataLayerEvent({ event: "line_friend_added", user_id: "not-a-uuid", user_email: "raw@example.test", revenue: 42, transaction_id: id })).toBe(true);
    expect(events).toEqual([{ event: "line_friend_added" }]);
  });
});

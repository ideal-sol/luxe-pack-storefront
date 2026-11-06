import { createHash, webcrypto } from "node:crypto";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import { GoogleTagManagerNoScript, GoogleTagManagerScript } from "@/components/analytics/google-tag-manager";
import { gtmContainerId, pushDataLayerEvent, reportPurchaseComplete, reportRegistrationComplete } from "@/lib/analytics/gtm";

// Inert Script mock: never executes a container or makes advertising requests.
vi.mock("next/script", () => ({
  default: ({ children, id }: { children: string; id: string }) => <script data-testid={id}>{children}</script>,
}));

type DataLayerWindow = Window & { dataLayer?: unknown[] };
const target = window as DataLayerWindow;
const user = "00000000-0000-4000-8000-000000000001";

function tags() {
  return <><GoogleTagManagerScript /><GoogleTagManagerNoScript /></>;
}

describe("Google Tag Manager", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST0001");
    vi.stubGlobal("crypto", webcrypto);
    delete target.dataLayer;
    window.localStorage.clear();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it.each([undefined, "", "GTM-", "UA-12345", "GTM-abc<script>", "GTM-ABCD'", "GTM-ABCDEFGHIJKLM"])(
    "renders nothing and never accesses storage or dataLayer when id is %s, even in production mode", async (value) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_GTM_ID", value);
      const storage = vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("must not access storage"); });
      const layer = vi.fn(() => { throw new Error("must not access dataLayer"); });
      const layerWrite = vi.fn();
      Object.defineProperty(window, "dataLayer", { configurable: true, get: layer, set: layerWrite });
      try {
        expect(gtmContainerId()).toBeNull();
        const { container } = render(tags());
        expect(container).toBeEmptyDOMElement();
        expect(renderToStaticMarkup(tags())).toBe("");
        await expect(reportRegistrationComplete(user)).resolves.toBeUndefined();
        expect(pushDataLayerEvent({ event: "registration_complete", user_id: user })).toBe(false);
        expect(storage).not.toHaveBeenCalled();
        expect(layer).not.toHaveBeenCalled();
        expect(layerWrite).not.toHaveBeenCalled();
      } finally { delete target.dataLayer; }
    },
  );

  it("renders the configured base tag and noscript iframe without executing them", () => {
    const { getByTestId } = render(tags());
    expect(getByTestId("google-tag-manager").textContent).toContain("'dataLayer','GTM-TEST0001'");
    expect(getByTestId("google-tag-manager").textContent).toContain("https://www.googletagmanager.com/gtm.js?id=");
    const html = renderToStaticMarkup(tags());
    expect(html).toContain("<noscript><iframe");
    expect(html).toContain('src="https://www.googletagmanager.com/ns.html?id=GTM-TEST0001"');
    expect(target.dataLayer).toBeUndefined();
  });

  it("suppresses repeats in the same browser per user and sends UUID without email", async () => {
    target.dataLayer = [{ event: "existing" }];
    await reportRegistrationComplete(user);
    await reportRegistrationComplete(user);
    await reportRegistrationComplete("00000000-0000-4000-8000-000000000002");
    expect(target.dataLayer).toEqual([{ event: "existing" }, { event: "registration_complete", user_id: user }, { event: "registration_complete", user_id: "00000000-0000-4000-8000-000000000002" }]);
    expect(JSON.stringify(window.localStorage)).not.toContain(user);
  });

  it("can send again in another browser/device with independent storage (no global uniqueness)", async () => {
    await reportRegistrationComplete(user);
    expect(target.dataLayer).toEqual([{ event: "registration_complete", user_id: user }]);
    // Simulate a separate browser profile without deleting the original marker.
    const entries = new Map<string, string>();
    const anotherBrowser = {
      dataLayer: undefined as unknown[] | undefined,
      localStorage: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => { entries.set(key, value); },
      },
    };
    vi.stubGlobal("window", anotherBrowser);
    try {
      await reportRegistrationComplete(user);
      await reportRegistrationComplete(user);
      expect(anotherBrowser.dataLayer).toEqual([{ event: "registration_complete", user_id: user }]);
      expect(entries.size).toBe(1);
    } finally { vi.unstubAllGlobals(); }
    expect(target.dataLayer).toEqual([{ event: "registration_complete", user_id: user }]);
    expect(window.localStorage.length).toBe(1);
  });

  it.each(["getItem", "setItem"] as const)("contains denied storage %s; deduplication becomes best effort", async (operation) => {
    vi.spyOn(Storage.prototype, operation).mockImplementation(() => { throw new Error("storage denied"); });
    await expect(reportRegistrationComplete(user)).resolves.toBeUndefined();
    expect(target.dataLayer).toEqual([{ event: "registration_complete", user_id: user }]);
    await expect(reportRegistrationComplete(user)).resolves.toBeUndefined();
    expect(target.dataLayer).toHaveLength(2);
  });

  it("contains denied storage getter", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("storage denied"); });
    await expect(reportRegistrationComplete(user)).resolves.toBeUndefined();
    expect(target.dataLayer).toEqual([{ event: "registration_complete", user_id: user }]);
  });

  it.each([null, {}, Object.freeze([]), { push: () => { throw new Error("unexpected push"); } }])(
    "contains malformed or frozen dataLayer %s without marking an unsent event", async (value) => {
      Object.defineProperty(window, "dataLayer", { configurable: true, writable: true, value });
      await expect(reportRegistrationComplete(user)).resolves.toBeUndefined();
      expect(window.localStorage.length).toBe(0);
    },
  );

  it("contains throwing dataLayer getters and push methods", async () => {
    Object.defineProperty(window, "dataLayer", { configurable: true, get() { throw new Error("layer unavailable"); } });
    await expect(reportRegistrationComplete(user)).resolves.toBeUndefined();
    delete target.dataLayer;
    target.dataLayer = [];
    vi.spyOn(target.dataLayer, "push").mockImplementation(() => { throw new Error("push unavailable"); });
    await expect(reportRegistrationComplete(user)).resolves.toBeUndefined();
    expect(window.localStorage.length).toBe(0);
  });

  it("ignores a missing user and server-side execution", async () => {
    await reportRegistrationComplete(null);
    expect(target.dataLayer).toBeUndefined();
    expect(window.localStorage.length).toBe(0);
    vi.stubGlobal("window", undefined);
    try { await expect(reportRegistrationComplete(user)).resolves.toBeUndefined(); }
    finally { vi.unstubAllGlobals(); }
  });
  it.each(["  Test.User@Example.COM ", "　ＴＥＳＴ．ＵＳＥＲ＠ＥＸＡＭＰＬＥ．ＣＯＭ\t\n"])("normalizes and hashes %s in one push", async email => {
    const expected = createHash("sha256").update("test.user@example.com").digest("hex");
    await Promise.all([reportRegistrationComplete(user, email), reportRegistrationComplete(user, email)]);
    expect(target.dataLayer).toEqual([{ event: "registration_complete", user_id: user, user_email: expected }]);
    expect(expected).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(target.dataLayer)).not.toContain("@");
    expect(JSON.stringify(window.localStorage)).not.toContain(expected);
    expect(JSON.stringify(window.localStorage)).not.toContain(user);
  });

  it.each([null, "", "　\t\n"])("omits missing/empty email %j", async email => {
    await reportRegistrationComplete(user, email);
    expect(target.dataLayer).toEqual([{ event: "registration_complete", user_id: user }]);
  });

  it("does not mark or push until crypto settles; contains crypto failure", async () => {
    let reject!: (reason: Error) => void;
    vi.stubGlobal("crypto", { subtle: { digest: () => new Promise((_, fail) => { reject = fail; }) } });
    const pending = reportRegistrationComplete(user, "test.user@example.com");
    await reportRegistrationComplete(user, "test.user@example.com");
    expect(target.dataLayer).toBeUndefined();
    expect(window.localStorage.length).toBe(0);
    reject(new Error("crypto unavailable"));
    await pending;
    expect(target.dataLayer).toEqual([{ event: "registration_complete", user_id: user }]);
  });

  it("allowlists keys and rejects raw, uppercase and malformed hashes", () => {
    for (const value of ["test.user@example.com", "A".repeat(64), "", "a".repeat(63)]) {
      pushDataLayerEvent({ event: "registration_complete", user_id: user, user_email: value, phone: "fixture" } as Parameters<typeof pushDataLayerEvent>[0]);
    }
    expect(target.dataLayer).toEqual(Array(4).fill({ event: "registration_complete", user_id: user }));
  });

});

let purchaseSequence = 0;
function purchaseInput() {
  purchaseSequence++;
  return { userId: user, email: "  Test.User@Example.COM ", revenue: 1500, paymentId: `00000000-0000-4000-9000-${String(purchaseSequence).padStart(12, "0")}` };
}

describe("purchase conversion", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST0001");
    vi.stubGlobal("crypto", webcrypto);
    delete target.dataLayer;
    window.localStorage.clear();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("pushes one exact payload, persists only an opaque marker, and suppresses overlap/reload", async () => {
    const input = purchaseInput();
    await Promise.all([reportPurchaseComplete(input), reportPurchaseComplete(input)]);
    const digest = createHash("sha256").update("test.user@example.com").digest("hex");
    expect(target.dataLayer).toEqual([{ event: "purchase_complete", user_id: user, user_email: digest, revenue: 1500, transaction_id: input.paymentId }]);
    expect(JSON.stringify(window.localStorage)).not.toMatch(/@|00000000-/);
    expect(JSON.stringify(window.localStorage)).not.toContain(digest);
    vi.resetModules();
    await (await import("@/lib/analytics/gtm")).reportPurchaseComplete(input);
    expect(target.dataLayer).toHaveLength(1);
    await reportPurchaseComplete(purchaseInput());
    expect(target.dataLayer).toHaveLength(2);
  });

  it.each([undefined, "", "bad"])("does no analytics work for disabled ID %j", async id => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", id);
    const storage = vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("must not access"); });
    const digest = vi.fn(); vi.stubGlobal("crypto", { subtle: { digest } });
    const layer = vi.fn(); Object.defineProperty(window, "dataLayer", { configurable: true, get: layer });
    await reportPurchaseComplete(purchaseInput());
    expect(storage).not.toHaveBeenCalled(); expect(layer).not.toHaveBeenCalled(); expect(digest).not.toHaveBeenCalled();
    delete target.dataLayer;
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1500", undefined])("rejects invalid amount %j", async revenue => {
    await reportPurchaseComplete({ ...purchaseInput(), revenue: revenue as number });
    expect(target.dataLayer).toBeUndefined(); expect(window.localStorage.length).toBe(0);
  });

  it.each([null, "", "not-a-uuid"])("rejects invalid user/payment identity %j", async value => {
    await reportPurchaseComplete({ ...purchaseInput(), userId: value });
    await reportPurchaseComplete({ ...purchaseInput(), paymentId: value as string });
    expect(target.dataLayer).toBeUndefined(); expect(window.localStorage.length).toBe(0);
  });

  it.each(["missing", "failed", "unavailable", "fullwidth"])("handles email %s with the shared normalization", async mode => {
    const input = purchaseInput();
    if (mode === "missing") input.email = "　\t\n";
    if (mode === "fullwidth") input.email = "ＴＥＳＴ．ＵＳＥＲ＠ＥＸＡＭＰＬＥ．ＣＯＭ";
    if (mode === "failed") vi.stubGlobal("crypto", { subtle: { digest: async () => { throw new Error("denied"); } } });
    if (mode === "unavailable") vi.stubGlobal("crypto", undefined);
    await reportPurchaseComplete(input);
    const expected = { event: "purchase_complete", user_id: user, revenue: 1500, transaction_id: input.paymentId };
    expect(target.dataLayer).toEqual([mode === "fullwidth" ? { event: expected.event, user_id: user, user_email: createHash("sha256").update("test.user@example.com").digest("hex"), revenue: 1500, transaction_id: input.paymentId } : expected]);
  });

  it.each(["getItem", "setItem"] as const)("suppresses repeats in memory when storage %s fails", async operation => {
    vi.spyOn(Storage.prototype, operation).mockImplementation(() => { throw new Error("denied"); });
    const input = purchaseInput();
    await reportPurchaseComplete(input); await reportPurchaseComplete(input);
    expect(target.dataLayer).toHaveLength(1);
  });

  it("reserves pending work without a premature marker, and retries a failed push", async () => {
    let finish!: (value: ArrayBuffer) => void;
    vi.stubGlobal("crypto", { subtle: { digest: () => new Promise<ArrayBuffer>(resolve => { finish = resolve; }) } });
    const input = purchaseInput();
    const pending = reportPurchaseComplete(input);
    await reportPurchaseComplete(input);
    expect(target.dataLayer).toBeUndefined(); expect(window.localStorage.length).toBe(0);
    target.dataLayer = Object.freeze([]) as unknown as unknown[];
    finish(new Uint8Array(32).buffer); await pending;
    expect(window.localStorage.length).toBe(0);
    target.dataLayer = []; vi.stubGlobal("crypto", webcrypto);
    await reportPurchaseComplete(input);
    expect(target.dataLayer).toHaveLength(1); expect(window.localStorage.length).toBe(1);
  });

  it("uses event-specific allowlists and validates purchases at the push boundary", () => {
    const input = purchaseInput();
    const attrs = { user_id: user, user_email: "raw@example.test", revenue: 1500, transaction_id: input.paymentId, phone: "fixture" };
    expect(pushDataLayerEvent({ event: "registration_complete", ...attrs })).toBe(true);
    expect(target.dataLayer).toEqual([{ event: "registration_complete", user_id: user }]);
    expect(pushDataLayerEvent({ event: "purchase_complete", user_id: user })).toBe(false);
    expect(pushDataLayerEvent({ event: "purchase_complete", ...attrs })).toBe(true);
    expect(target.dataLayer?.[1]).toEqual({ event: "purchase_complete", user_id: user, revenue: 1500, transaction_id: input.paymentId });
  });
});

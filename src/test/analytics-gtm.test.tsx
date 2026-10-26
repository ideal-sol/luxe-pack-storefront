import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import { GoogleTagManagerNoScript, GoogleTagManagerScript } from "@/components/analytics/google-tag-manager";
import { gtmContainerId, pushDataLayerEvent, reportRegistrationComplete } from "@/lib/analytics/gtm";

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
    delete target.dataLayer;
    window.localStorage.clear();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it.each([undefined, "", "GTM-", "UA-12345", "GTM-abc<script>", "GTM-ABCD'", "GTM-ABCDEFGHIJKLM"])(
    "renders nothing and never accesses storage or dataLayer when id is %s, even in production mode", (value) => {
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
        expect(() => reportRegistrationComplete(user)).not.toThrow();
        expect(pushDataLayerEvent({ event: "registration_complete" })).toBe(false);
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

  it("suppresses repeats in the same browser per user and sends event name only", () => {
    target.dataLayer = [{ event: "existing" }];
    reportRegistrationComplete(user);
    reportRegistrationComplete(user);
    reportRegistrationComplete("00000000-0000-4000-8000-000000000002");
    expect(target.dataLayer).toEqual([{ event: "existing" }, { event: "registration_complete" }, { event: "registration_complete" }]);
    expect(JSON.stringify(window.localStorage)).not.toContain(user);
  });

  it("can send again in another browser/device with independent storage (no global uniqueness)", () => {
    reportRegistrationComplete(user);
    expect(target.dataLayer).toEqual([{ event: "registration_complete" }]);
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
      reportRegistrationComplete(user);
      reportRegistrationComplete(user);
      expect(anotherBrowser.dataLayer).toEqual([{ event: "registration_complete" }]);
      expect(entries.size).toBe(1);
    } finally { vi.unstubAllGlobals(); }
    expect(target.dataLayer).toEqual([{ event: "registration_complete" }]);
    expect(window.localStorage.length).toBe(1);
  });

  it.each(["getItem", "setItem"] as const)("contains denied storage %s; deduplication becomes best effort", (operation) => {
    vi.spyOn(Storage.prototype, operation).mockImplementation(() => { throw new Error("storage denied"); });
    expect(() => reportRegistrationComplete(user)).not.toThrow();
    expect(target.dataLayer).toEqual([{ event: "registration_complete" }]);
    expect(() => reportRegistrationComplete(user)).not.toThrow();
    expect(target.dataLayer).toHaveLength(2);
  });

  it("contains denied storage getter", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("storage denied"); });
    expect(() => reportRegistrationComplete(user)).not.toThrow();
    expect(target.dataLayer).toEqual([{ event: "registration_complete" }]);
  });

  it.each([null, {}, Object.freeze([]), { push: () => { throw new Error("unexpected push"); } }])(
    "contains malformed or frozen dataLayer %s without marking an unsent event", (value) => {
      Object.defineProperty(window, "dataLayer", { configurable: true, writable: true, value });
      expect(() => reportRegistrationComplete(user)).not.toThrow();
      expect(window.localStorage.length).toBe(0);
    },
  );

  it("contains throwing dataLayer getters and push methods", () => {
    Object.defineProperty(window, "dataLayer", { configurable: true, get() { throw new Error("layer unavailable"); } });
    expect(() => reportRegistrationComplete(user)).not.toThrow();
    delete target.dataLayer;
    target.dataLayer = [];
    vi.spyOn(target.dataLayer, "push").mockImplementation(() => { throw new Error("push unavailable"); });
    expect(() => reportRegistrationComplete(user)).not.toThrow();
    expect(window.localStorage.length).toBe(0);
  });

  it("ignores a missing user and server-side execution", () => {
    reportRegistrationComplete(null);
    expect(target.dataLayer).toBeUndefined();
    expect(window.localStorage.length).toBe(0);
    vi.stubGlobal("window", undefined);
    try { expect(() => reportRegistrationComplete(user)).not.toThrow(); }
    finally { vi.unstubAllGlobals(); }
  });
});

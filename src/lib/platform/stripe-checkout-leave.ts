import { USER_XSRF_COOKIE, XSRF_TOKEN_HEADER } from "@oripa/storefront-client";
import { createBrowserAuthClient } from "./auth-client";
import { readPlatformRuntimeConfiguration } from "./runtime-configuration";

export const STRIPE_OFFER_REFRESH = "luxe-pack:stripe-offer-refresh";

function readToken() {
  const prefix = USER_XSRF_COOKIE + "=";
  const token = document.cookie.split(";").map(part => part.trim()).find(part => part.startsWith(prefix))?.slice(prefix.length);
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}

// Prepare while the input screen is open. pagehide never initializes CSRF.
export async function prepareStripeLeave(paymentId: string, cancelKey: string) {
  const configuration = readPlatformRuntimeConfiguration();
  const base = new URL(configuration.baseUrl, window.location.origin);
  if (base.origin !== window.location.origin || base.search || base.hash || base.username || base.password ||
      !paymentId || paymentId === "." || paymentId === ".." || /[\s/\\\0]/.test(paymentId)) {
    throw new Error("決済の取消を準備できませんでした");
  }
  if (!readToken()) await createBrowserAuthClient(configuration).getCurrentSession();
  if (!readToken()) throw new Error("決済の取消を準備できませんでした");
  const url = base.href.replace(/\/$/, "") + "/payments/" + encodeURIComponent(paymentId) + "/stripe-checkout-cancellations";
  return () => {
    const token = readToken();
    if (!token) return;
    void fetch(url, {
      method: "POST", credentials: "include", keepalive: true, redirect: "error", cache: "no-store",
      headers: {
        Accept: "application/json", "Content-Type": "application/json",
        "X-Oripa-Client-Version": "2.0.0-alpha.56", "X-Oripa-Site-Version": configuration.siteVersion,
        [XSRF_TOKEN_HEADER]: token, "Idempotency-Key": cancelKey,
      },
      body: JSON.stringify({ trigger: "leave" }),
    }).then(() => window.dispatchEvent(new Event(STRIPE_OFFER_REFRESH))).catch(() => undefined);
  };
}

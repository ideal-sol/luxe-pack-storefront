import { PAYMENT_UI_UNAVAILABLE } from "@/lib/platform/payment-ui-gateway";

// These providers have no documented SDK disposer. Once loaded, their entire
// document (including provider-owned frames, 3DS and listeners) is the lifetime
// boundary. Never reuse it for another checkout or member.
let owner: { active: boolean; leaving: boolean; logout: boolean } | null = null;

export function leaveProviderDocument(href = window.location.href): boolean {
  if (!owner) return false;
  owner.active = false;
  if (!owner.leaving && !owner.logout) {
    owner.leaving = true;
    window.location.replace(href);
  }
  return true;
}

// Revoke callbacks before logout starts, but do not interrupt its canonical
// request by unloading the document. Completion (including failure) retires it.
export function deferProviderDocumentForLogout(): () => void {
  const current = owner;
  if (!current) return () => undefined;
  current.active = false;
  current.logout = true;
  return () => {
    current.logout = false;
    leaveProviderDocument();
  };
}

export function ownProviderDocument(signal: AbortSignal) {
  signal.throwIfAborted();
  if (owner) throw new Error(PAYMENT_UI_UNAVAILABLE);
  const current = { active: true, leaving: false, logout: false };
  owner = current;
  const stop = () => { leaveProviderDocument(); };
  signal.addEventListener("abort", stop, { once: true });
  // Intercept site links before Next's SPA handler. Provider frames remain in
  // the top document; the SDK owns their focus and 3DS behavior.
  document.addEventListener("click", event => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(anchor instanceof HTMLAnchorElement) || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
        anchor.download || anchor.target && anchor.target !== "_self" || !["http:", "https:"].includes(anchor.protocol)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    leaveProviderDocument(anchor.href);
  }, true);
  window.addEventListener("popstate", stop);
  window.addEventListener("pagehide", () => { current.active = false; current.leaving = true; });
  window.addEventListener("pageshow", event => {
    if (event.persisted) {
      current.leaving = false;
      leaveProviderDocument();
    }
  });
  return {
    active: () => current.active && !signal.aborted,
    assertActive: () => { if (!current.active || signal.aborted) throw new Error(PAYMENT_UI_UNAVAILABLE); },
    dispose: stop,
  };
}

export async function boundedProviderOperation<T>(operation: Promise<T>, signal: AbortSignal, milliseconds = 15_000): Promise<T> {
  signal.throwIfAborted();
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void = () => undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      abort = () => reject(new Error(PAYMENT_UI_UNAVAILABLE));
      signal.addEventListener("abort", abort, { once: true });
      timer = setTimeout(abort, milliseconds);
    })]);
  } finally {
    clearTimeout(timer!);
    signal.removeEventListener("abort", abort);
  }
}

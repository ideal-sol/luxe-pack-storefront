import { requiresSmsVerification, smsVerificationRoute } from "./routes/navigation";

function safeReturn(value: string | null) {
  if (!value || !value.startsWith("/") || /[\\\\#\x00-\x20\x7f]/.test(value)) return null;
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || !requiresSmsVerification(url.pathname)) return null;
  const safeQuery = new URLSearchParams();
  for (const name of ["card_registration_id", "pid"]) {
    const parameter = url.searchParams.get(name);
    if (parameter && /^[0-9a-f-]{36}$/i.test(parameter)) safeQuery.set(name, parameter);
  }
  return url.pathname + (safeQuery.size ? `?${safeQuery}` : "");
}

export function smsVerificationHref() {
  const destination = safeReturn(window.location.pathname + window.location.search);
  return destination ? `${smsVerificationRoute}?returnTo=${encodeURIComponent(destination)}` : smsVerificationRoute;
}

export function smsReturnDestination() {
  return safeReturn(new URLSearchParams(window.location.search).get("returnTo")) ?? "/mypage";
}

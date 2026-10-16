export const preRegisterRoute = "/pre-register";
export const preRegisterSmsRoute = "/pre-register/sms";
export const preRegisterThanksRoute = "/pre-register/thanks";
export const preRegisterEmailRedirectPath = preRegisterSmsRoute;
export const preRegisterLoginHref = "/login?returnTo=%2Fpre-register%2Fsms";
export const preRegisterOpenDateLabel = "11月1日（日）";
export const preRegisterBonusCoins = "500コイン";
export const officialXUrl = "https://x.com/oripoke_jp";

export function httpsUrl(value: string | undefined): string | null {
  if (!value || value !== value.trim()) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname && !parsed.username && !parsed.password ? parsed.href : null;
  } catch {
    return null;
  }
}

export const officialLineUrl = httpsUrl(process.env.NEXT_PUBLIC_OFFICIAL_LINE_URL);

export function pendingRegistrationId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value) ? value : null;
}

export function isPreRegisterReturn(value: unknown): boolean {
  return value === preRegisterSmsRoute;
}

export function usesPreRegisterShell(pathname: string): boolean {
  return [preRegisterRoute, preRegisterSmsRoute, preRegisterThanksRoute, "/login", "/password-reset", "/password-reset/confirm", "/pages/terms", "/pages/privacy", "/verify-email", "/verify-email/error"].includes(pathname)
    || /^\/verify-email\/[^/]+\/[^/]+$/.test(pathname);
}

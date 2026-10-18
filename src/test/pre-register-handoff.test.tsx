import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { dynamic, metadata, revalidate } from "@/app/pre-register/layout";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";

const handoff = JSON.parse(readFileSync("docs/operations/pre-registration-v14-basic-exceptions.json", "utf8"));

it("documents actual public routes while retaining protected normal routes", () => {
  expect(handoff.pages).toEqual([
    "/pre-register", "/pre-register/sms", "/pre-register/thanks", "/login",
    "/password-reset", "/password-reset/confirm", "/pages/terms", "/pages/privacy", "/verify-email", "/verify-email/error",
  ]);
  expect(handoff.email_verification_page).toBe("/verify-email/{userId}/{hash}");
  expect(handoff.must_remain_protected).toEqual(["/", "/register", "/mypage", "/mypage/sms-verification", "/points", "/gachas"]);
  for (const route of handoff.must_remain_protected) expect(handoff.pages).not.toContain(route);
  expect(handoff.pages.some((route: string) => route.includes("*"))).toBe(false);
});

it("includes status APIs, CSRF bootstrap, legal content and reused SMS operations", () => {
  const operations = handoff.same_origin_api.map((entry: { method: string; path: string }) => entry.method + " " + entry.path);
  for (const operation of [
    "GET /auth/session", "POST /auth/pre-register", "POST /auth/login",
    "GET /campaigns/pre-registration", "GET /me/pre-registration-bonus",
    "POST /auth/email/verification-notification", "GET /auth/email/verify/{userId}/{hash}",
    "POST /auth/password/forgot", "POST /auth/password/reset",
    "GET /me/sms-verification", "POST /me/sms-verification", "POST /me/sms-verification/resend",
    "POST /me/sms-verification/verify", "POST /me/password/reauthenticate",
    "GET /content/pages/terms", "GET /content/pages/privacy", "GET /advertising-code-validation",
  ]) expect(operations).toContain(operation);
  expect(operations).toHaveLength(17);
  expect(handoff.static_prefixes).toEqual(["/_next/", "/brand/", "/fonts/"]);
  expect(handoff.runtime_verification).toMatch(/PENDING/);
});

it("documents conditional reset landing and preserves the existing token-removing proxy", () => {
  const userId = "0198a001-0000-7000-8000-000000000501";
  const token = "b".repeat(64);
  const landing = handoff.password_reset_landing;
  expect(landing.path).toBe("/");
  expect(landing.method).toBe("GET");
  expect(landing.query_keys).toEqual(["password_reset_user_id", "token"]);
  expect(new RegExp(landing.user_id_pattern).test(userId)).toBe(true);
  expect(new RegExp(landing.token_pattern).test(token)).toBe(true);
  expect(new RegExp(landing.token_pattern).test("bad")).toBe(false);
  const result = proxy(new NextRequest("https://storefront.test/?password_reset_user_id=" + userId + "&token=" + token));
  const destination = new URL(result.headers.get("location")!);
  expect(destination.pathname).toBe("/password-reset/confirm");
  expect(destination.search).toBe("");
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(result.headers.get("referrer-policy")).toBe("no-referrer");
  expect(proxy(new NextRequest("https://storefront.test/")).headers.get("location")).toBeNull();
});

it("sets dynamic no-store rendering and noindex metadata on all three pages", () => {
  expect(dynamic).toBe("force-dynamic");
  expect(revalidate).toBe(0);
  expect(metadata.robots).toMatchObject({ index: false, follow: false });
});

it.each([undefined, "http://line.test/friend", "https://", "https://line.test/friend"])("renders LINE only for valid build configuration %s", async (value) => {
  vi.stubEnv("NEXT_PUBLIC_OFFICIAL_LINE_URL", value);
  vi.resetModules();
  const { PreRegisterThanks } = await import("@/components/pre-register/pre-register-thanks");
  const html = renderToStaticMarkup(<PreRegisterThanks />);
  expect(html.includes("公式LINEを友だち追加する")).toBe(value === "https://line.test/friend");
  if (value === "https://line.test/friend") {
    expect(html).toContain('href="https://line.test/friend"');
    expect(html.indexOf("公式Xをフォローする")).toBeLessThan(html.indexOf("公式LINEを友だち追加する"));
  }
  vi.unstubAllEnvs();
  vi.resetModules();
});

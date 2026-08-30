import { getRedirectUrl } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

const origin = "https://storefront.example.test";
const userId = "0198a001-0000-7000-8000-000000000502";
const requestId = "0198a001-0000-7000-8000-000000000601";

function redirected(url: string) {
  const response = proxy(new NextRequest(url));
  const location = getRedirectUrl(response);
  if (!location) throw new Error("Expected Account Security redirect");
  return { response, url: new URL(location) };
}

describe("Account Security link proxy", () => {
  it("matches only the Platform URL-builder landing path", () => {
    expect(config).toEqual({ matcher: "/" });
  });

  it("moves a valid Password Reset token out of the server-visible query", () => {
    const token = "a".repeat(64);
    const { response, url } = redirected(`${origin}/?password_reset_user_id=${userId}&token=${token}`);
    const fragment = new URLSearchParams(url.hash.slice(1));

    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(url.pathname).toBe("/password-reset/confirm");
    expect(url.search).toBe("");
    expect(fragment.get("account_security")).toBe("password-reset");
    expect(fragment.get("password_reset_user_id")).toBe(userId);
    expect(fragment.get("token")).toBe(token);
  });

  it("moves a valid Email Change token out of the server-visible query", () => {
    const token = "b".repeat(64);
    const { response, url } = redirected(`${origin}/?email_change_request_id=${requestId}&token=${token}`);
    const fragment = new URLSearchParams(url.hash.slice(1));

    expect(response.status).toBe(307);
    expect(url.pathname).toBe("/email-change/verify");
    expect(url.search).toBe("");
    expect(fragment.get("account_security")).toBe("email-change");
    expect(fragment.get("email_change_request_id")).toBe(requestId);
    expect(fragment.get("token")).toBe(token);
  });

  it("does not carry malformed or ambiguous token input to the destination", () => {
    const { url } = redirected(`${origin}/?password_reset_user_id=bad&email_change_request_id=bad&token=raw-token`);
    expect(url.pathname).toBe("/password-reset/confirm");
    expect(url.search).toBe("");
    expect(url.hash).toBe("#account_security=password-reset");
    expect(url.href).not.toContain("raw-token");
  });

  it("preserves the existing root behavior when Account Security parameters are absent", () => {
    const response = proxy(new NextRequest(`${origin}/?card_registration_id=registration-public-reference`));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });
});

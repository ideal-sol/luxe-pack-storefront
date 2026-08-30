import { NextResponse, type NextRequest } from "next/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

function secureRedirect(request: NextRequest, path: string, fragment: URLSearchParams) {
  const destination = new URL(path, request.url);
  destination.search = "";
  destination.hash = fragment.toString();
  const response = NextResponse.redirect(destination, 307);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function proxy(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const hasEmailRequest = query.has("email_change_request_id");
  const hasPasswordResetUser = query.has("password_reset_user_id");
  const hasToken = query.has("token");
  if (!hasEmailRequest && !hasPasswordResetUser && !hasToken) return NextResponse.next();

  const token = query.get("token");
  if (hasEmailRequest && !hasPasswordResetUser) {
    const requestId = query.get("email_change_request_id");
    const fragment = new URLSearchParams({ account_security: "email-change" });
    if (requestId && token && UUID_PATTERN.test(requestId) && TOKEN_PATTERN.test(token)) {
      fragment.set("email_change_request_id", requestId);
      fragment.set("token", token);
    }
    return secureRedirect(request, "/email-change/verify", fragment);
  }

  const userId = query.get("password_reset_user_id");
  const fragment = new URLSearchParams({ account_security: "password-reset" });
  if (!hasEmailRequest && userId && token && UUID_PATTERN.test(userId) && TOKEN_PATTERN.test(token)) {
    fragment.set("password_reset_user_id", userId);
    fragment.set("token", token);
  }
  return secureRedirect(request, "/password-reset/confirm", fragment);
}

export const config = { matcher: "/" };

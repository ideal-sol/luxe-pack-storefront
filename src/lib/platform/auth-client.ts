import { createStorefrontIdentityClient } from "@oripa/storefront-client";
import { createBrowserStorefrontClient } from "@oripa/storefront-client/browser";
import type {
  PublicComponents,
  StorefrontIdentityClient,
  StorefrontTransport,
} from "@oripa/storefront-client";
import {
  readPlatformRuntimeConfiguration,
  type PlatformRuntimeConfiguration,
} from "./runtime-configuration";

type Schemas = PublicComponents["schemas"];

export type AuthSession = Schemas["UserSession"];
export type LoginRequest = Schemas["PasswordLoginRequest"];
export type RegistrationRequest = Schemas["UserRegistrationRequest"];
export type PendingRegistration = Schemas["PendingRegistration"];
export type VerificationResendRequest = Schemas["VerificationResendRequest"];

export interface AuthClientAdapter {
  readonly completeEmailVerification: StorefrontIdentityClient["completeEmailVerification"];
  readonly getCurrentSession: StorefrontIdentityClient["getCurrentSession"];
  readonly login: StorefrontIdentityClient["login"];
  readonly logout: StorefrontIdentityClient["logout"];
  readonly register: StorefrontIdentityClient["register"];
  readonly resendEmailVerification: StorefrontIdentityClient["resendEmailVerification"];
}

export function createAuthClientAdapter(transport: StorefrontTransport): AuthClientAdapter {
  const identity = createStorefrontIdentityClient(transport);
  return {
    completeEmailVerification: identity.completeEmailVerification,
    getCurrentSession: identity.getCurrentSession,
    login: identity.login,
    logout: identity.logout,
    register: identity.register,
    resendEmailVerification: identity.resendEmailVerification,
  };
}

export function createBrowserAuthClient(
  configuration: PlatformRuntimeConfiguration = readPlatformRuntimeConfiguration(),
  overrides: Pick<Parameters<typeof createBrowserStorefrontClient>[0], "cookie_reader" | "fetch"> = {},
): AuthClientAdapter {
  const transport = createBrowserStorefrontClient({
    base_url: configuration.baseUrl,
    default_timeout_ms: configuration.defaultTimeoutMs,
    site_version: configuration.siteVersion,
    ...overrides,
  });
  return createAuthClientAdapter(transport);
}

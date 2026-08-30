import { createStorefrontIdentityClient } from "@oripa/storefront-client";
import type {
  PublicComponents,
  StorefrontIdentityClient,
  StorefrontTransport,
} from "@oripa/storefront-client";
import {
  type PlatformRuntimeConfiguration,
} from "./runtime-configuration";
import { createBrowserPlatformTransport, type BrowserClientOverrides } from "./browser-client";

type Schemas = PublicComponents["schemas"];

export type AuthSession = Schemas["UserSession"];
export type LoginRequest = Schemas["PasswordLoginRequest"];
export type RegistrationRequest = Schemas["UserRegistrationRequest"];
export type PendingRegistration = Schemas["PendingRegistration"];
export type VerificationResendRequest = Schemas["VerificationResendRequest"];
export type PasswordResetRequest = Schemas["PasswordResetRequest"];
export type PasswordResetAccepted = Schemas["PasswordResetAccepted"];
export type PasswordResetConfirmRequest = Schemas["PasswordResetConfirmRequest"];
export type PasswordResetCompleted = Schemas["PasswordResetCompleted"];
export type EmailChangeRequest = Schemas["EmailChangeRequest"];
export type EmailChangePending = Schemas["EmailChangePending"];
export type EmailChangeCompleteRequest = Schemas["EmailChangeCompleteRequest"] & { readonly request_id: string };
export type EmailChangeCompleted = Schemas["EmailChangeCompleted"];
export type PasswordChangeRequest = Schemas["UserPasswordChangeRequest"];
export type PasswordChanged = Schemas["UserPasswordChanged"];

export interface AuthClientAdapter {
  readonly changeUserPassword: StorefrontIdentityClient["changeUserPassword"];
  readonly completeEmailChange: StorefrontIdentityClient["completeEmailChange"];
  readonly completeEmailVerification: StorefrontIdentityClient["completeEmailVerification"];
  readonly confirmPasswordReset: StorefrontIdentityClient["confirmPasswordReset"];
  readonly createEmailChangeRequest: StorefrontIdentityClient["createEmailChangeRequest"];
  readonly getCurrentSession: StorefrontIdentityClient["getCurrentSession"];
  readonly login: StorefrontIdentityClient["login"];
  readonly logout: StorefrontIdentityClient["logout"];
  readonly register: StorefrontIdentityClient["register"];
  readonly requestPasswordReset: StorefrontIdentityClient["requestPasswordReset"];
  readonly resendEmailVerification: StorefrontIdentityClient["resendEmailVerification"];
}

export function createAuthClientAdapter(transport: StorefrontTransport): AuthClientAdapter {
  const identity = createStorefrontIdentityClient(transport);
  return {
    changeUserPassword: identity.changeUserPassword,
    completeEmailChange: identity.completeEmailChange,
    completeEmailVerification: identity.completeEmailVerification,
    confirmPasswordReset: identity.confirmPasswordReset,
    createEmailChangeRequest: identity.createEmailChangeRequest,
    getCurrentSession: identity.getCurrentSession,
    login: identity.login,
    logout: identity.logout,
    register: identity.register,
    requestPasswordReset: identity.requestPasswordReset,
    resendEmailVerification: identity.resendEmailVerification,
  };
}

export function createBrowserAuthClient(
  configuration?: PlatformRuntimeConfiguration,
  overrides: BrowserClientOverrides = {},
): AuthClientAdapter {
  const transport = createBrowserPlatformTransport(configuration, overrides);
  return createAuthClientAdapter(transport);
}

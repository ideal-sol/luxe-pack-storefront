import {
  createStorefrontIdentityClient,
  isAuthProblemError,
  type PublicComponents,
  type StorefrontIdentityClient,
  type StorefrontTransport,
} from "@oripa/storefront-client";
import { createBrowserPlatformTransport, type BrowserClientOverrides } from "./browser-client";
import { presentPlatformProblem, type PlatformProblemPresentation } from "./problem-details";
import type { PlatformRuntimeConfiguration } from "./runtime-configuration";

type Schemas = PublicComponents["schemas"];

export type ExternalIdentity = Schemas["ExternalIdentity"];
export type ExternalIdentityCollection = Schemas["ExternalIdentityCollection"];
export type ExternalIdentityStart = Schemas["ExternalIdentityStart"];
export type ExternalIdentitySession = Schemas["ExternalIdentitySession"];
export type LineFriendState = Schemas["LineFriendStatePresentation"];

export interface ExternalIdentityProblemPresentation extends PlatformProblemPresentation {
  readonly authenticationRequired: boolean;
}

export type ExternalIdentityAdapter = Pick<
  StorefrontIdentityClient,
  | "completeLineLogin"
  | "getLineFriendState"
  | "listExternalIdentities"
  | "startLineIdentityLink"
  | "startLineReauthentication"
  | "unlinkLineIdentity"
>;

export function createExternalIdentityAdapter(transport: StorefrontTransport): ExternalIdentityAdapter {
  const identity = createStorefrontIdentityClient(transport);
  return {
    completeLineLogin: identity.completeLineLogin,
    getLineFriendState: identity.getLineFriendState,
    listExternalIdentities: identity.listExternalIdentities,
    startLineIdentityLink: identity.startLineIdentityLink,
    startLineReauthentication: identity.startLineReauthentication,
    unlinkLineIdentity: identity.unlinkLineIdentity,
  };
}

export function presentExternalIdentityProblem(error: unknown): ExternalIdentityProblemPresentation {
  return {
    ...presentPlatformProblem(error),
    authenticationRequired: isAuthProblemError(error, "AUTHENTICATION_REQUIRED"),
  };
}

export function createBrowserExternalIdentityClient(
  configuration?: PlatformRuntimeConfiguration,
  overrides: BrowserClientOverrides = {},
): ExternalIdentityAdapter {
  return createExternalIdentityAdapter(createBrowserPlatformTransport(configuration, overrides));
}

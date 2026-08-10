import {
  createStorefrontIdentityClient,
  type PublicComponents,
  type StorefrontIdentityClient,
  type StorefrontTransport,
} from "@oripa/storefront-client";
import { createBrowserPlatformTransport, type BrowserClientOverrides } from "./browser-client";
import type { PlatformRuntimeConfiguration } from "./runtime-configuration";

type Schemas = PublicComponents["schemas"];

export type ExternalIdentity = Schemas["ExternalIdentity"];
export type ExternalIdentityCollection = Schemas["ExternalIdentityCollection"];
export type ExternalIdentityStart = Schemas["ExternalIdentityStart"];
export type ExternalIdentitySession = Schemas["ExternalIdentitySession"];

export type ExternalIdentityAdapter = Pick<
  StorefrontIdentityClient,
  | "completeLineLogin"
  | "listExternalIdentities"
  | "startLineIdentityLink"
  | "startLineReauthentication"
  | "unlinkLineIdentity"
>;

export function createExternalIdentityAdapter(transport: StorefrontTransport): ExternalIdentityAdapter {
  const identity = createStorefrontIdentityClient(transport);
  return {
    completeLineLogin: identity.completeLineLogin,
    listExternalIdentities: identity.listExternalIdentities,
    startLineIdentityLink: identity.startLineIdentityLink,
    startLineReauthentication: identity.startLineReauthentication,
    unlinkLineIdentity: identity.unlinkLineIdentity,
  };
}

export function createBrowserExternalIdentityClient(
  configuration?: PlatformRuntimeConfiguration,
  overrides: BrowserClientOverrides = {},
): ExternalIdentityAdapter {
  return createExternalIdentityAdapter(createBrowserPlatformTransport(configuration, overrides));
}

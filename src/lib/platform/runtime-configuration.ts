export const STOREFRONT_SITE_VERSION = "0.1.0";

export interface PlatformRuntimeConfiguration {
  readonly baseUrl: string;
  readonly defaultTimeoutMs: number;
  readonly siteVersion: string;
}

export class PlatformConfigurationError extends Error {
  readonly code = "PLATFORM_CONFIGURATION_UNAVAILABLE";

  constructor(message = "Platform API connection is not configured.") {
    super(message);
    this.name = "PlatformConfigurationError";
  }
}

export function readPlatformRuntimeConfiguration(): PlatformRuntimeConfiguration {
  const baseUrl = process.env.NEXT_PUBLIC_PLATFORM_API_BASE_URL?.trim();
  if (!baseUrl) throw new PlatformConfigurationError();

  return {
    baseUrl,
    defaultTimeoutMs: 10_000,
    siteVersion: STOREFRONT_SITE_VERSION,
  };
}

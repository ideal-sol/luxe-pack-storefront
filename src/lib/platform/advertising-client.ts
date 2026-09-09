import { createStorefrontIdentityClient } from "@oripa/storefront-client";
import { createAdvertisingLastClickService } from "@/lib/advertising-last-click";
import { createBrowserPlatformTransport } from "./browser-client";

export const advertisingLastClick = createAdvertisingLastClickService(async (code) =>
  createStorefrontIdentityClient(createBrowserPlatformTransport()).validateAdvertisingCode(code),
);

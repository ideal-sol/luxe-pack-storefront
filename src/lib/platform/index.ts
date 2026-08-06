export {
  createAuthClientAdapter,
  createBrowserAuthClient,
  type AuthClientAdapter,
  type AuthSession,
  type LoginRequest,
  type PendingRegistration,
  type RegistrationRequest,
  type VerificationResendRequest,
} from "./auth-client";
export { presentAuthProblem, type AuthProblemPresentation } from "./problem-details";
export { presentPlatformProblem, type PlatformProblemPresentation } from "./problem-details";
export {
  createBrowserPublicClient,
  createPublicCatalogAdapter,
  type ContentBanner,
  type ContentNoticeSummary,
  type GachaCategory,
  type GachaSummary,
  type GachaSummaryCollection,
  type PublicCatalogAdapter,
} from "./public-client";
export {
  PlatformConfigurationError,
  readPlatformRuntimeConfiguration,
  type PlatformRuntimeConfiguration,
} from "./runtime-configuration";

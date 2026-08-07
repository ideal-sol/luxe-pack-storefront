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
export {
  isPlatformNotFound,
  presentPlatformProblem,
  type PlatformProblemPresentation,
} from "./problem-details";
export {
  createBrowserPublicClient,
  createPublicCatalogAdapter,
  type ContentBanner,
  type ContentNotice,
  type ContentNoticeCollection,
  type ContentNoticeSummary,
  type ContentStaticPage,
  type GachaCategory,
  type GachaDetail,
  type GachaPresentationState,
  type GachaSaleState,
  type GachaSummary,
  type GachaSummaryCollection,
  type PublicCatalogAdapter,
} from "./public-client";
export {
  PlatformConfigurationError,
  readPlatformRuntimeConfiguration,
  type PlatformRuntimeConfiguration,
} from "./runtime-configuration";

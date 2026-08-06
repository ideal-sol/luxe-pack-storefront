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
  PlatformConfigurationError,
  readPlatformRuntimeConfiguration,
  type PlatformRuntimeConfiguration,
} from "./runtime-configuration";

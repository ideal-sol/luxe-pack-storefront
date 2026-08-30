const CARD_REGISTRATION_RESUME_KEY = "luxe-pack:card-registration-resume:v1";
const IDEMPOTENCY_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CardRegistrationResumePhase =
  | "awaiting_return"
  | "return_processing"
  | "payment_starting";

export interface CardRegistrationResumeContext {
  readonly paymentIdempotencyKey: string;
  readonly phase: CardRegistrationResumePhase;
  readonly productId: string;
  readonly registrationId: string;
}

function storage() {
  if (typeof window === "undefined") throw new Error("Card registration resume requires a Browser");
  return window.sessionStorage;
}

function isContext(value: unknown): value is CardRegistrationResumeContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Record<string, unknown>;
  return Object.keys(context).sort().join(",") ===
      "paymentIdempotencyKey,phase,productId,registrationId" &&
    typeof context.paymentIdempotencyKey === "string" &&
    IDEMPOTENCY_KEY.test(context.paymentIdempotencyKey) &&
    typeof context.productId === "string" &&
    context.productId.length > 0 &&
    typeof context.registrationId === "string" &&
    context.registrationId.length > 0 &&
    ["awaiting_return", "return_processing", "payment_starting"].includes(String(context.phase));
}

function write(context: CardRegistrationResumeContext) {
  storage().setItem(CARD_REGISTRATION_RESUME_KEY, JSON.stringify(context));
}

export function assertCardRegistrationResumeAvailable() {
  const target = storage();
  const probe = `${CARD_REGISTRATION_RESUME_KEY}:probe`;
  target.setItem(probe, "1");
  target.removeItem(probe);
}

export function readCardRegistrationResume(): CardRegistrationResumeContext | null {
  const target = storage();
  const raw = target.getItem(CARD_REGISTRATION_RESUME_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (isContext(value)) return value;
  } catch {
  }
  target.removeItem(CARD_REGISTRATION_RESUME_KEY);
  return null;
}

export function saveCardRegistrationResume(
  context: Omit<CardRegistrationResumeContext, "phase">,
) {
  write({ ...context, phase: "awaiting_return" });
}

export function beginCardRegistrationReturn(
  registrationId: string,
  productId: string,
): CardRegistrationResumeContext | null {
  const context = readCardRegistrationResume();
  if (!context || context.phase !== "awaiting_return" ||
      context.registrationId !== registrationId || context.productId !== productId) return null;
  const processing = { ...context, phase: "return_processing" } as const;
  write(processing);
  return processing;
}

export function markCardRegistrationPaymentStarting(registrationId: string) {
  const context = readCardRegistrationResume();
  if (!context || context.phase !== "return_processing" || context.registrationId !== registrationId) {
    return null;
  }
  const paymentStarting = { ...context, phase: "payment_starting" } as const;
  write(paymentStarting);
  return paymentStarting;
}

export function clearCardRegistrationResume(registrationId: string) {
  const context = readCardRegistrationResume();
  if (context?.registrationId === registrationId) storage().removeItem(CARD_REGISTRATION_RESUME_KEY);
}

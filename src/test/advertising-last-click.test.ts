import { PUBLIC_ADVERTISING_ATTRIBUTION_FIXTURES as fixtures } from "@oripa/storefront-testkit";
import {
  ADVERTISING_COOKIE_NAME, ADVERTISING_MAX_AGE_SECONDS,
  advertisingCandidateFromQuery, advertisingRegistrationFields,
  createAdvertisingLastClickService, readAdvertisingCandidate,
} from "@/lib/advertising-last-click";

const A = "ABC123xy";
const B = "Def456Z9";
const clearCookie = () => { document.cookie = `${ADVERTISING_COOKIE_NAME}=; Path=/; Max-Age=0`; };

beforeEach(clearCookie);
afterEach(() => { vi.restoreAllMocks(); clearCookie(); vi.useRealTimers(); });

function harness() {
  const validate = vi.fn(async (code: string) => ({ data: code === A || code === B ? fixtures.valid : fixtures.invalid }));
  return { validate, service: createAdvertisingLastClickService(validate) };
}

describe("advertising Last Click", () => {
  it("stores valid A, then overwrites with valid B", async () => {
    const { service } = harness();
    await service.capture(`ad_code=${A}`);
    expect(readAdvertisingCandidate()).toBe(A);
    await service.capture(`ad_code=${B}`);
    expect(advertisingRegistrationFields()).toEqual({ advertising_code: B });
  });

  it.each([
    ["nonexistent", "ad_code=NoCode00", true],
    ["stopped agency", "ad_code=Stopped0", true],
    ["wrong case", "ad_code=abc123XY", true],
    ["malformed", "ad_code=INVALID", false],
    ["non ASCII", "ad_code=ＡBC123xy", false],
    ["whitespace", "ad_code=%20ABC123xy", false],
    ["trailing newline", "ad_code=ABC123xy%0A", false],
    ["absent", "category=pokemon", false],
    ["ambiguous duplicate", `ad_code=${A}&ad_code=${B}`, false],
  ])("preserves A after %s", async (_, query, callsValidation) => {
    const { service, validate } = harness();
    await service.capture(`ad_code=${A}`);
    validate.mockClear();
    await service.capture(query);
    expect(readAdvertisingCandidate()).toBe(A);
    expect(validate).toHaveBeenCalledTimes(callsValidation ? 1 : 0);
    if (callsValidation) expect(validate).toHaveBeenCalledWith(new URLSearchParams(query).get("ad_code"));
  });

  it.each([new TypeError("network error"), new Error("timeout"), { status: 503 }])(
    "preserves A when validation fails: %s", async (error) => {
      const { service, validate } = harness();
      await service.capture(`ad_code=${A}`);
      validate.mockRejectedValueOnce(error);
      await expect(service.capture(`ad_code=${B}`)).resolves.toBeUndefined();
      expect(readAdvertisingCandidate()).toBe(A);
    },
  );

  it.each([29, 30])("uses a 30-day browser expiry after same-code refresh (day %s)", async (days) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    const { service } = harness();
    const writes = vi.spyOn(document, "cookie", "set");
    await service.capture(`ad_code=${A}`);
    expect(writes).toHaveBeenLastCalledWith(`${ADVERTISING_COOKIE_NAME}=${A}; Path=/; Max-Age=2592000; SameSite=Lax`);
    vi.setSystemTime(new Date("2026-09-20T00:00:00Z"));
    expect(readAdvertisingCandidate()).toBe(A);
    await service.capture(`ad_code=${A}`);
    expect(writes).toHaveBeenCalledTimes(2);
    // Separate cases avoid tough-cookie extending Max-Age on every read.
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 20 + days)));
    expect(readAdvertisingCandidate()).toBe(days < 30 ? A : undefined);
    expect(advertisingRegistrationFields()).toEqual(days < 30 ? { advertising_code: A } : {});
    expect(ADVERTISING_MAX_AGE_SECONDS).toBe(2_592_000);
  });

  it("preserves unrelated session, CSRF and referral cookies", async () => {
    for (const name of ["session_fixture", "csrf_fixture", "referral_fixture"]) document.cookie = `${name}=untouched; Path=/`;
    const { service } = harness();
    await service.capture(`referral=Referral&ad_code=${A}`);
    for (const name of ["session_fixture", "csrf_fixture", "referral_fixture"]) {
      expect(document.cookie).toContain(`${name}=untouched`);
      document.cookie = `${name}=; Path=/; Max-Age=0`;
    }
    expect(advertisingCandidateFromQuery("referral=ABC123xy")).toBeUndefined();
  });

  it("does not let an older slow validation overwrite a later valid click", async () => {
    let resolveA!: (response: { data: { valid: boolean } }) => void;
    const service = createAdvertisingLastClickService((code) => code === A
      ? new Promise((resolve) => { resolveA = resolve; }) : Promise.resolve({ data: fixtures.valid }));
    const pending = service.capture(`ad_code=${A}`);
    await service.capture(`ad_code=${B}`);
    resolveA({ data: fixtures.valid });
    await pending;
    expect(readAdvertisingCandidate()).toBe(B);
  });

  it("retains an in-flight valid click across invalid and code-less navigation", async () => {
    let resolveA!: (response: { data: { valid: boolean } }) => void;
    const service = createAdvertisingLastClickService((code) => code === A
      ? new Promise((resolve) => { resolveA = resolve; }) : Promise.resolve({ data: fixtures.invalid }));
    const pending = service.capture(`ad_code=${A}`);
    await service.capture("ad_code=Stopped0");
    await service.capture("");
    resolveA({ data: fixtures.valid });
    await pending;
    expect(readAdvertisingCandidate()).toBe(A);
  });

  it("fails open when cookie access is unavailable and omits malformed cookies", async () => {
    document.cookie = `${ADVERTISING_COOKIE_NAME}=INVALID; Path=/`;
    expect(advertisingRegistrationFields()).toEqual({});
    vi.spyOn(document, "cookie", "get").mockImplementation(() => { throw new Error("unavailable"); });
    expect(advertisingRegistrationFields()).toEqual({});
    vi.spyOn(document, "cookie", "set").mockImplementation(() => { throw new Error("unavailable"); });
    await expect(harness().service.capture(`ad_code=${A}`)).resolves.toBeUndefined();
  });
});

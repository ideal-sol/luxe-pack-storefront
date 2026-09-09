export const ADVERTISING_QUERY_KEY = "ad_code";
export const ADVERTISING_COOKIE_NAME = "oripa_ad_last_click";
export const ADVERTISING_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const CODE_PATTERN = /^[A-Za-z0-9]{8}$/;

export function advertisingCandidateFromQuery(search: string): string | undefined {
  const values = new URLSearchParams(search).getAll(ADVERTISING_QUERY_KEY);
  const value = values[0];
  return values.length === 1 && value?.length === 8 && CODE_PATTERN.test(value) ? value : undefined;
}

export function readAdvertisingCandidate(): string | undefined {
  try {
    // The browser owns expiration; no second persisted authority is needed.
    const value = document.cookie.split(";").map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${ADVERTISING_COOKIE_NAME}=`))
      ?.slice(ADVERTISING_COOKIE_NAME.length + 1);
    return value?.length === 8 && CODE_PATTERN.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function advertisingRegistrationFields(): { advertising_code?: string } {
  const advertising_code = readAdvertisingCandidate();
  return advertising_code ? { advertising_code } : {};
}

function storeAdvertisingCandidate(code: string) {
  document.cookie = `${ADVERTISING_COOKIE_NAME}=${code}; Path=/; Max-Age=${ADVERTISING_MAX_AGE_SECONDS}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
}

export function createAdvertisingLastClickService(
  validate: (code: string) => Promise<{ readonly data: { readonly valid: boolean } }>,
  store: (code: string) => void = storeAdvertisingCandidate,
) {
  let sequence = 0;
  let lastStoredSequence = 0;
  return {
    async capture(search: string): Promise<void> {
      const code = advertisingCandidateFromQuery(search);
      if (!code) return;
      const clickSequence = ++sequence;
      try {
        const { data } = await validate(code);
        // A slower earlier valid response must not replace a newer valid click.
        // Invalid responses never invalidate an earlier valid candidate.
        if (data.valid === true && clickSequence > lastStoredSequence) {
          store(code);
          lastStoredSequence = clickSequence;
        }
      } catch {
        // Validation/configuration/storage failure cannot interrupt Storefront use.
      }
    },
  };
}

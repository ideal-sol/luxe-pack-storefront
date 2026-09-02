const PREFIX = "luxe-pack:sms-registration-prompt:";

function markerKey(userId: string) {
  return `${PREFIX}${userId}`;
}

export function markSmsRegistrationPrompt(userId: string) {
  try {
    window.sessionStorage.setItem(markerKey(userId), "pending");
  } catch {
    // The verification completion itself remains successful when browser storage is unavailable.
  }
}

export function consumeSmsRegistrationPrompt(userId: string) {
  try {
    const key = markerKey(userId);
    const pending = window.sessionStorage.getItem(key) === "pending";
    window.sessionStorage.removeItem(key);
    return pending;
  } catch {
    return false;
  }
}

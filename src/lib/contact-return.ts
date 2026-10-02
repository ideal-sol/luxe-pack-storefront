/** Only the Contact and login Gacha detail routes may override the default login destination. */
export function contactLoginReturn(value: string | readonly string[] | undefined): string {
  if (typeof value !== "string" || /[\\#\x00-\x20\x7f]/.test(value)) return "/mypage";
  if (/^\/login-gachas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
  return value === "/contact" || value.startsWith("/contact?") ? value : "/mypage";
}

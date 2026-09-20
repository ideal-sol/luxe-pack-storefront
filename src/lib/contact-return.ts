/** Only the existing Contact route may override the default login destination. */
export function contactLoginReturn(value: string | readonly string[] | undefined): string {
  if (typeof value !== "string" || /[\\#\x00-\x20\x7f]/.test(value)) return "/mypage";
  return value === "/contact" || value.startsWith("/contact?") ? value : "/mypage";
}

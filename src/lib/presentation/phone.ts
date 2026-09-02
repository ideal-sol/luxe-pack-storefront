export function normalizeJapaneseMobilePhone(value: string): string | null {
  const trimmed = value.trim();
  if (/^(?:070|080|090)\d{8}$/.test(trimmed)) return trimmed;
  if (/^(?:070|080|090)-\d{4}-\d{4}$/.test(trimmed)) return trimmed.replaceAll("-", "");
  return null;
}

export function formatVerifiedPhone(value: string): string {
  const domestic = /^\+81(70|80|90)(\d{4})(\d{4})$/.exec(value);
  if (domestic) return `0${domestic[1]}-${domestic[2]}-${domestic[3]}`;
  const local = /^(070|080|090)(\d{4})(\d{4})$/.exec(value);
  if (local) return `${local[1]}-${local[2]}-${local[3]}`;
  return value;
}

/**
 * Build URLs that preserve active filters while overriding specific params
 * (used by sort and pagination links). Values are allow-listed downstream by
 * Zod, so tampered params safely fall back to defaults.
 */

export function withSearchParams(
  path: string,
  current: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string" && first !== "") params.set(key, first);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

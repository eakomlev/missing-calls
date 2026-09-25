/**
 * Normalizes a phone number for comparison by keeping only digits and
 * taking the last 10 (national significant number), so "+7 910 123-45-67",
 * "79101234567" and "89101234567" all compare equal.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

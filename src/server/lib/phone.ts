const E164_SK_CZ = /^\+4(20|21)\d{9}$/;

/**
 * Normalize phone number to E.164 format (+421XXXXXXXXX or +420XXXXXXXXX).
 * Strips spaces, dashes, parentheses; handles Slovak and Czech input formats.
 *
 * Throws if the input cannot be normalized to a valid E.164 number — the
 * Zod validators upstream already enforce the strict shape, so this only
 * fires for callers that bypass validation.
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");

  // Already in E.164 format: +421... or +420...
  if (E164_SK_CZ.test(cleaned)) return cleaned;

  const digits = cleaned.replace(/\D/g, "");
  let result: string | null = null;

  // International dial-out prefix: 00421... or 00420... → +421... / +420...
  if ((digits.startsWith("00421") || digits.startsWith("00420")) && digits.length === 14) {
    result = "+" + digits.slice(2);
  }
  // Full prefix without +: 421903XXXXXXX or 420603XXXXXXX (exactly 12 digits)
  else if ((digits.startsWith("421") || digits.startsWith("420")) && digits.length === 12) {
    result = "+" + digits;
  }
  // Leading 0: 0903XXXXXXX → +421903XXXXXXX
  else if (digits.startsWith("0") && digits.length === 10) {
    result = "+421" + digits.slice(1);
  }
  // Bare 9-digit number → assume +421
  else if (digits.length === 9) {
    result = "+421" + digits;
  }

  if (!result || !E164_SK_CZ.test(result)) {
    throw new Error(`Invalid phone number: cannot normalize "${phone}" to E.164`);
  }
  return result;
}

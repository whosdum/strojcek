/**
 * Normalize phone number to E.164 format (+421XXXXXXXXX or +420XXXXXXXXX)
 * - Strips spaces, dashes, parentheses
 * - Handles Slovak and Czech input formats
 */
export function normalizePhone(phone: string): string {
  // Strip everything except digits and leading +
  const cleaned = phone.replace(/[^\d+]/g, "");

  // Already in E.164 format: +421... or +420...
  if (/^\+4(20|21)\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  // Strip everything except digits
  const digits = cleaned.replace(/\D/g, "");

  // Full prefix with country code: 421903... or 420603...
  if ((digits.startsWith("421") || digits.startsWith("420")) && digits.length >= 12) {
    return "+" + digits;
  }

  // Leading 0: 0903... → +421903...
  if (digits.startsWith("0") && digits.length === 10) {
    return "+421" + digits.slice(1);
  }

  // Just the 9-digit number: 903... (default to +421)
  if (digits.length === 9) {
    return "+421" + digits;
  }

  // Fallback: return with + prefix
  return "+" + digits;
}

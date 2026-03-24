/**
 * Normalize phone number to E.164 format (+421XXXXXXXXX)
 * - Strips spaces, dashes, parentheses
 * - Handles all common Slovak input formats
 */
export function normalizePhone(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, "");

  // Already has full Slovak prefix: 421903...
  if (digits.startsWith("421") && digits.length >= 12) {
    return "+" + digits;
  }

  // Leading 0: 0903... → 421903...
  if (digits.startsWith("0") && digits.length === 10) {
    return "+421" + digits.slice(1);
  }

  // Just the 9-digit number: 903... (from form with +421 prefix shown)
  if (digits.length === 9 && /^[0-9]/.test(digits)) {
    return "+421" + digits;
  }

  // Fallback: return with + prefix
  return "+" + digits;
}

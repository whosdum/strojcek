/**
 * Normalize phone number to E.164 format (+421XXXXXXXXX)
 * - Strips spaces, dashes, parentheses
 * - Converts leading 0 to +421 (Slovak numbers)
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");

  if (cleaned.startsWith("00421")) {
    cleaned = "+" + cleaned.slice(2);
  } else if (cleaned.startsWith("0") && !cleaned.startsWith("00")) {
    cleaned = "+421" + cleaned.slice(1);
  } else if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

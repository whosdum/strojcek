import { escapeHtml } from "./utils";
import {
  PUBLIC_SITE_URL,
  SHOP_NAME,
  SHOP_ADDRESS_FULL,
  SHOP_PHONE_DISPLAY,
  SHOP_STREET,
  SHOP_CITY,
} from "@/lib/business-info";

interface BookingConfirmationProps {
  customerName: string;
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  price: string;
  cancelUrl: string;
  startTimeUtc: string;
  endTimeUtc: string;
}

export function bookingConfirmationHtml({
  customerName,
  serviceName,
  barberName,
  date,
  time,
  price,
  cancelUrl,
  startTimeUtc,
  endTimeUtc,
}: BookingConfirmationProps): string {
  const safeCustomerName = escapeHtml(customerName);
  const safeServiceName = escapeHtml(serviceName);
  const safeBarberName = escapeHtml(barberName);
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(time);
  const safePrice = escapeHtml(price);

  // Customer-facing URL — pinned to the canonical public domain. The
  // .ics file is served by /api/calendar from whatever deployment the
  // customer hits, but we never want a staging-tested booking to ship a
  // `*.hosted.app` link in real customer email.
  const appUrl = PUBLIC_SITE_URL;
  const toCalFormat = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const calStart = toCalFormat(startTimeUtc);
  const calEnd = toCalFormat(endTimeUtc);
  const calTitle = encodeURIComponent(`${SHOP_NAME} — ${safeServiceName}`);
  // calDetails goes through encodeURIComponent — use raw values (not the
  // HTML-escaped safe* forms), otherwise "&" in a name renders as "&amp;"
  // inside the calendar invite.
  const calDetails = encodeURIComponent(`Barber: ${barberName}\nSlužba: ${serviceName}\nCena: ${price} €`);
  const calLocation = encodeURIComponent(SHOP_ADDRESS_FULL);

  const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${calStart}/${calEnd}&details=${calDetails}&location=${calLocation}`;

  const icsUrl = `${appUrl}/api/calendar?start=${encodeURIComponent(startTimeUtc)}&end=${encodeURIComponent(endTimeUtc)}&title=${calTitle}&description=${calDetails}&location=${calLocation}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    @media (prefers-color-scheme: dark) {
      body { background-color: #0f0f17 !important; }
      .email-card { background-color: #1a1a2e !important; }
      .email-text { color: #e5e5e5 !important; }
      .email-muted { color: #a3a3a3 !important; }
      .email-row-label { color: #a3a3a3 !important; }
      .email-row-divider { border-color: #2a2a3e !important; }
      .email-footer-link { color: #a3a3a3 !important; }
      .email-cancel-text { color: #a3a3a3 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <tr>
      <td style="background-color: #1a1a2e; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ff703a; margin: 0; font-size: 24px; font-weight: bold;">Strojček</h1>
        <p style="color: #999; margin: 4px 0 0; font-size: 13px;">Barbershop</p>
      </td>
    </tr>
    <tr>
      <td class="email-card" style="background-color: #ffffff; padding: 32px 24px;">
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 10px 16px; margin-bottom: 24px; text-align: center;">
          <span style="color: #059669; font-weight: bold; font-size: 14px;">✓ Potvrdená</span>
        </div>
        <p class="email-text" style="color: #333; margin: 0 0 20px; font-size: 15px;">Dobrý deň, ${safeCustomerName},</p>
        <p class="email-text" style="color: #333; margin: 0 0 24px; font-size: 15px;">Vaša rezervácia bola úspešne potvrdená.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td class="email-row-label email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px; width: 100px;">Služba</td>
            <td class="email-text email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right; color: #333;">${safeServiceName}</td>
          </tr>
          <tr>
            <td class="email-row-label email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px;">Barber</td>
            <td class="email-text email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right; color: #333;">${safeBarberName}</td>
          </tr>
          <tr>
            <td class="email-row-label email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px;">Dátum</td>
            <td class="email-text email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right; color: #333;">${safeDate}</td>
          </tr>
          <tr>
            <td class="email-row-label email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px;">Čas</td>
            <td class="email-text email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right; color: #333;">${safeTime}</td>
          </tr>
          <tr>
            <td class="email-row-label" style="padding: 12px 0; color: #888; font-size: 14px;">Cena</td>
            <td style="padding: 12px 0; font-weight: bold; font-size: 16px; text-align: right; color: #ff703a;">${safePrice} €</td>
          </tr>
        </table>
        <p class="email-muted" style="color: #666; margin: 24px 0 8px; font-size: 13px;">Pridať do kalendára:</p>
        <p style="margin: 0 0 24px; font-size: 13px;">
          <a href="${googleCalUrl}" target="_blank" style="color: #1a73e8; text-decoration: underline;">Google Kalendár</a>
          &nbsp;·&nbsp;
          <a href="${icsUrl}" style="color: #1a73e8; text-decoration: underline;">Apple / Outlook (.ics)</a>
        </p>
        <p class="email-cancel-text" style="color: #999; margin: 0; font-size: 12px; text-align: center;">
          Ak potrebujete rezerváciu zrušiť (najneskôr 2h pred termínom), môžete tak urobiť
          <a href="${cancelUrl}" class="email-footer-link" style="color: #999; text-decoration: underline;">tu</a>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #1a1a2e; padding: 20px 24px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #888; margin: 0; font-size: 12px;">${SHOP_NAME} Barbershop · ${SHOP_STREET}, ${SHOP_CITY}</p>
        <p style="color: #666; margin: 4px 0 0; font-size: 11px;">Tel: ${SHOP_PHONE_DISPLAY}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

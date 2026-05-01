import { escapeHtml } from "./utils";
import {
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://strojcekbarbershop.sk";
  const toCalFormat = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const calStart = toCalFormat(startTimeUtc);
  const calEnd = toCalFormat(endTimeUtc);
  const calTitle = encodeURIComponent(`${SHOP_NAME} — ${safeServiceName}`);
  const calDetails = encodeURIComponent(`Barber: ${safeBarberName}\nSlužba: ${safeServiceName}\nCena: ${price} €`);
  const calLocation = encodeURIComponent(SHOP_ADDRESS_FULL);

  const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${calStart}/${calEnd}&details=${calDetails}&location=${calLocation}`;

  const icsUrl = `${appUrl}/api/calendar?start=${encodeURIComponent(startTimeUtc)}&end=${encodeURIComponent(endTimeUtc)}&title=${calTitle}&description=${calDetails}&location=${calLocation}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <tr>
      <td style="background-color: #1a1a2e; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ff703a; margin: 0; font-size: 24px; font-weight: bold;">Strojček</h1>
        <p style="color: #999; margin: 4px 0 0; font-size: 13px;">Barbershop</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #ffffff; padding: 32px 24px;">
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 10px 16px; margin-bottom: 24px; text-align: center;">
          <span style="color: #059669; font-weight: bold; font-size: 14px;">✓ Potvrdená</span>
        </div>
        <p style="color: #333; margin: 0 0 20px; font-size: 15px;">Dobrý deň, ${safeCustomerName},</p>
        <p style="color: #333; margin: 0 0 24px; font-size: 15px;">Vaša rezervácia bola úspešne potvrdená.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px; width: 100px;">Služba</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right;">${safeServiceName}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px;">Barber</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right;">${safeBarberName}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px;">Dátum</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right;">${safeDate}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px;">Čas</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right;">${safeTime}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #888; font-size: 14px;">Cena</td>
            <td style="padding: 12px 0; font-weight: bold; font-size: 16px; text-align: right; color: #ff703a;">${safePrice} €</td>
          </tr>
        </table>
        <p style="color: #666; margin: 24px 0 8px; font-size: 13px;">Pridať do kalendára:</p>
        <p style="margin: 0 0 24px; font-size: 13px;">
          <a href="${googleCalUrl}" target="_blank" style="color: #1a73e8; text-decoration: underline;">Google Kalendár</a>
          &nbsp;·&nbsp;
          <a href="${icsUrl}" style="color: #1a73e8; text-decoration: underline;">Apple / Outlook (.ics)</a>
        </p>
        <p style="color: #999; margin: 0; font-size: 12px; text-align: center;">
          Ak potrebujete rezerváciu zrušiť (najneskôr 2h pred termínom), môžete tak urobiť
          <a href="${cancelUrl}" style="color: #999; text-decoration: underline;">na tejto stránke</a>.
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

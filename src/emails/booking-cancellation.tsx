import { escapeHtml } from "./utils";
import { SHOP_NAME, SHOP_STREET, SHOP_CITY, SHOP_PHONE_DISPLAY } from "@/lib/business-info";

interface BookingCancellationProps {
  customerName: string;
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  bookUrl: string;
}

export function bookingCancellationHtml({
  customerName,
  serviceName,
  barberName,
  date,
  time,
  bookUrl,
}: BookingCancellationProps): string {
  const safeCustomerName = escapeHtml(customerName);
  const safeServiceName = escapeHtml(serviceName);
  const safeBarberName = escapeHtml(barberName);
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(time);

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
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 16px; margin-bottom: 24px; text-align: center;">
          <span style="color: #dc2626; font-weight: bold; font-size: 14px;">✕ Zrušená</span>
        </div>
        <p class="email-text" style="color: #333; margin: 0 0 20px; font-size: 15px;">Dobrý deň, ${safeCustomerName},</p>
        <p class="email-text" style="color: #333; margin: 0 0 24px; font-size: 15px;">Vaša rezervácia bola úspešne zrušená:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td class="email-row-label email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px; width: 100px;">Služba</td>
            <td class="email-text email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: right; color: #333;">${safeServiceName}</td>
          </tr>
          <tr>
            <td class="email-row-label email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px;">Barber</td>
            <td class="email-text email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: right; color: #333;">${safeBarberName}</td>
          </tr>
          <tr>
            <td class="email-row-label email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px;">Dátum</td>
            <td class="email-text email-row-divider" style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: right; color: #333;">${safeDate}</td>
          </tr>
          <tr>
            <td class="email-row-label" style="padding: 12px 0; color: #888; font-size: 14px;">Čas</td>
            <td class="email-text" style="padding: 12px 0; font-size: 14px; text-align: right; color: #333;">${safeTime}</td>
          </tr>
        </table>
        <p class="email-muted" style="color: #666; margin: 24px 0 16px; font-size: 14px;">Chcete si vytvoriť novú rezerváciu?</p>
        <div style="text-align: center;">
          <a href="${bookUrl}" style="display: inline-block; padding: 12px 32px; background-color: #ff703a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">Nová rezervácia</a>
        </div>
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

import { escapeHtml } from "./utils";
import { SHOP_NAME, SHOP_STREET, SHOP_CITY, SHOP_PHONE_DISPLAY } from "@/lib/business-info";

interface BookingReminderProps {
  customerName: string;
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  cancelUrl?: string;
}

export function bookingReminderHtml({
  customerName,
  serviceName,
  barberName,
  date,
  time,
  cancelUrl,
}: BookingReminderProps): string {
  const safeCustomerName = escapeHtml(customerName);
  const safeServiceName = escapeHtml(serviceName);
  const safeBarberName = escapeHtml(barberName);
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(time);

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
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 16px; margin-bottom: 24px; text-align: center;">
          <span style="color: #2563eb; font-weight: bold; font-size: 14px;">🔔 Pripomienka</span>
        </div>
        <p style="color: #333; margin: 0 0 20px; font-size: 15px;">Dobrý deň, ${safeCustomerName},</p>
        <p style="color: #333; margin: 0 0 24px; font-size: 15px;">Pripomíname vám zajtrajšiu rezerváciu:</p>
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
            <td style="padding: 12px 0; color: #888; font-size: 14px;">Čas</td>
            <td style="padding: 12px 0; font-weight: bold; font-size: 14px; text-align: right;">${safeTime}</td>
          </tr>
        </table>
        ${cancelUrl
          ? `<p style="color: #666; margin: 24px 0 8px; font-size: 13px;">Ak potrebujete rezerváciu zrušiť (najneskôr 2 hodiny pred termínom):</p>
        <div style="text-align: center; margin-top: 12px;">
          <a href="${cancelUrl}" style="color: #ff703a; font-size: 14px; text-decoration: underline;">Zrušiť rezerváciu</a>
        </div>`
          : `<p style="color: #666; margin: 24px 0 8px; font-size: 13px;">Ak potrebujete rezerváciu zrušiť, použite odkaz z potvrdzovacieho emailu.</p>`
        }
        <p style="color: #333; margin: 24px 0 0; font-size: 15px; text-align: center;">Tešíme sa na vás! 💈</p>
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

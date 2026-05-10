import { escapeHtml } from "./utils";
import {
  SHOP_NAME,
  SHOP_STREET,
  SHOP_CITY,
  SHOP_PHONE_DISPLAY,
  SHOP_MAPS_URL,
} from "@/lib/business-info";

interface BookingReviewProps {
  customerName: string;
  serviceName: string;
  barberName: string;
}

export function bookingReviewHtml({
  customerName,
  serviceName,
  barberName,
}: BookingReviewProps): string {
  const safeCustomerName = escapeHtml(customerName);
  const safeServiceName = escapeHtml(serviceName);
  const safeBarberName = escapeHtml(barberName);
  const reviewUrl = SHOP_MAPS_URL;

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
      .email-quote { background-color: #16213e !important; border-color: #2a2a3e !important; }
      .email-footer-link { color: #a3a3a3 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <tr>
      <td style="background-color: #1a1a2e; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fc873a; margin: 0; font-size: 24px; font-weight: bold;">Strojček</h1>
        <p style="color: #999; margin: 4px 0 0; font-size: 13px;">Barbershop</p>
      </td>
    </tr>
    <tr>
      <td class="email-card" style="background-color: #ffffff; padding: 32px 24px;">
        <p class="email-text" style="color: #333; margin: 0 0 16px; font-size: 18px; font-weight: bold;">
          Dobrý deň, ${safeCustomerName} 👋
        </p>
        <p class="email-text" style="color: #333; margin: 0 0 16px; font-size: 15px; line-height: 1.6;">
          ďakujeme, že ste nás navštívili a využili službu <strong>${safeServiceName}</strong> u barbera <strong>${safeBarberName}</strong>.
        </p>
        <p class="email-text" style="color: #333; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
          Veľmi nám záleží na tom, či ste odchádzali spokojný — a ešte viac nám pomôže, ak svoju skúsenosť zdieľate s ostatnými.
        </p>

        <div class="email-quote" style="background-color: #fff7ed; border-left: 3px solid #fc873a; border-radius: 6px; padding: 16px 20px; margin: 0 0 28px;">
          <p class="email-text" style="color: #333; margin: 0 0 8px; font-size: 15px; line-height: 1.55;">
            <strong>Krátka recenzia na Google nám urobí radosť</strong> — a pomáha novým zákazníkom nájsť nás.
          </p>
          <p class="email-muted" style="color: #666; margin: 0; font-size: 13px; line-height: 1.5;">
            Trvá to menej ako minútu a pre malý lokálny podnik ako my to znamená naozaj veľa.
          </p>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 0 0 24px;">
              <a href="${reviewUrl}" target="_blank" rel="noopener" style="display: inline-block; background-color: #fc873a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 15px; line-height: 1;">
                <span style="display: inline-block; vertical-align: middle; line-height: 1;">⭐</span>
                <span style="display: inline-block; vertical-align: middle; line-height: 1; margin-left: 6px;">Napísať recenziu na Google</span>
              </a>
            </td>
          </tr>
        </table>

        <p class="email-text" style="color: #333; margin: 0 0 8px; font-size: 14px; line-height: 1.55;">
          Ak by niečo nebolo podľa vašich predstáv, dajte nám prosím vedieť priamo — radi to napravíme. Stačí odpovedať na tento email alebo zavolať na <strong>${SHOP_PHONE_DISPLAY}</strong>.
        </p>
        <p class="email-text" style="color: #333; margin: 16px 0 0; font-size: 15px;">
          Tešíme sa na vás opäť. ✂️
        </p>
        <p class="email-muted" style="color: #666; margin: 4px 0 0; font-size: 14px;">
          Tím Strojček
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

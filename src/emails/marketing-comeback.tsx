import {
  PUBLIC_SITE_URL,
  SHOP_NAME,
  SHOP_STREET,
  SHOP_CITY,
  SHOP_PHONE_DISPLAY,
  SHOP_PHONE_E164,
} from "@/lib/business-info";

export function marketingComebackHtml(): string {
  const bookUrl = PUBLIC_SITE_URL;

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
      .email-quote { background-color: #16213e !important; }
      .email-divider { border-color: #2a2a3e !important; }
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
        <p class="email-text" style="color: #333; margin: 0 0 16px; font-size: 22px; font-weight: bold; line-height: 1.3;">
          Nie je čas na nový strih? ✂️
        </p>
        <p class="email-text" style="color: #333; margin: 0 0 20px; font-size: 15px; line-height: 1.6;">
          Dobrý deň,
        </p>
        <p class="email-text" style="color: #333; margin: 0 0 20px; font-size: 15px; line-height: 1.6;">
          ozývame sa zo Strojčeka s pár novinkami.
        </p>

        <div class="email-quote" style="background-color: #fff7ed; border-left: 3px solid #fc873a; border-radius: 6px; padding: 16px 20px; margin: 0 0 20px;">
          <p class="email-text" style="color: #333; margin: 0 0 8px; font-size: 15px; font-weight: bold; line-height: 1.5;">
            🆕 Nový rezervačný systém
          </p>
          <p class="email-text" style="color: #333; margin: 0; font-size: 14px; line-height: 1.6;">
            Spustili sme nový rezervačný formulár priamo na našom webe — termín si zarezervujete za pár klikov, bez registrácie.
          </p>
        </div>

        <p class="email-text" style="color: #333; margin: 0 0 20px; font-size: 15px; line-height: 1.6;">
          A ak je to od poslednej návštevy už nejaký ten týždeň, radi vás opäť uvidíme v kresle.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 8px 0 24px;">
              <a href="${bookUrl}" target="_blank" rel="noopener" style="display: inline-block; background-color: #fc873a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px; line-height: 1;">
                Rezervovať termín
              </a>
            </td>
          </tr>
        </table>

        <p class="email-muted" style="color: #666; margin: 0 0 4px; font-size: 13px; text-align: center; line-height: 1.5;">
          alebo nám zavolajte na <a href="tel:${SHOP_PHONE_E164}" style="color: #333; font-weight: bold; text-decoration: underline;">${SHOP_PHONE_DISPLAY}</a>
        </p>

        <hr class="email-divider" style="border: none; border-top: 1px solid #f0f0f0; margin: 28px 0 20px;">

        <p class="email-text" style="color: #333; margin: 0; font-size: 15px;">
          Tešíme sa na vás.
        </p>
        <p class="email-muted" style="color: #666; margin: 4px 0 0; font-size: 14px;">
          Tím Strojček
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #1a1a2e; padding: 20px 24px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #888; margin: 0 0 8px; font-size: 12px;">${SHOP_NAME} Barbershop · ${SHOP_STREET}, ${SHOP_CITY}</p>
        <p style="color: #666; margin: 0; font-size: 11px;">Tel: ${SHOP_PHONE_DISPLAY}</p>
        <p class="email-footer-link" style="color: #555; margin: 12px 0 0; font-size: 11px; line-height: 1.5;">
          Tento email ste dostali ako náš zákazník. Ak si podobné novinky neželáte dostávať, stačí odpovedať a my vás odstránime zo zoznamu.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

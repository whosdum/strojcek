interface BookingConfirmationProps {
  customerName: string;
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  price: string;
  cancelUrl: string;
}

export function bookingConfirmationHtml({
  customerName,
  serviceName,
  barberName,
  date,
  time,
  price,
  cancelUrl,
}: BookingConfirmationProps): string {
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
        <p style="color: #333; margin: 0 0 20px; font-size: 15px;">Dobrý deň, ${customerName},</p>
        <p style="color: #333; margin: 0 0 24px; font-size: 15px;">Vaša rezervácia bola úspešne potvrdená.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px; width: 100px;">Služba</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right;">${serviceName}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px;">Barbier</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right;">${barberName}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px;">Dátum</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right;">${date}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #888; font-size: 14px;">Čas</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-weight: bold; font-size: 14px; text-align: right;">${time}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #888; font-size: 14px;">Cena</td>
            <td style="padding: 12px 0; font-weight: bold; font-size: 16px; text-align: right; color: #ff703a;">${price} €</td>
          </tr>
        </table>
        <p style="color: #666; margin: 24px 0 16px; font-size: 13px;">Ak potrebujete rezerváciu zrušiť (najneskôr 2 hodiny pred termínom):</p>
        <div style="text-align: center;">
          <a href="${cancelUrl}" style="display: inline-block; padding: 12px 32px; background-color: #ff703a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">Zrušiť rezerváciu</a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #1a1a2e; padding: 20px 24px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #888; margin: 0; font-size: 12px;">Strojček Barbershop · Moyzesova 379/2, Bytča</p>
        <p style="color: #666; margin: 4px 0 0; font-size: 11px;">Tel: 0944 932 871</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface BookingReminderProps {
  customerName: string;
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  cancelUrl: string;
}

export function bookingReminderHtml({
  customerName,
  serviceName,
  barberName,
  date,
  time,
  cancelUrl,
}: BookingReminderProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ea580c;">Pripomienka rezervácie</h2>
  <p>Dobrý deň, ${customerName},</p>
  <p>Pripomíname vám zajtrajšiu rezerváciu:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Služba</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${serviceName}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Barber</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${barberName}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Dátum</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${date}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Čas</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${time}</td></tr>
  </table>
  <p>Ak potrebujete rezerváciu zrušiť, kliknite na odkaz nižšie (najneskôr 2 hodiny pred termínom):</p>
  <p><a href="${cancelUrl}" style="color: #ea580c;">Zrušiť rezerváciu</a></p>
  <p>Tešíme sa na vás!</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Strojček Barber Shop</p>
</body>
</html>`;
}

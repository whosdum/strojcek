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
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ea580c;">Rezervácia zrušená</h2>
  <p>Dobrý deň, ${customerName},</p>
  <p>Vaša rezervácia bola úspešne zrušená:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Služba</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${serviceName}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Barber</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${barberName}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Dátum</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${date}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Čas</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${time}</td></tr>
  </table>
  <p>Ak si chcete vytvoriť novú rezerváciu:</p>
  <p><a href="${bookUrl}" style="display: inline-block; padding: 12px 24px; background-color: #ea580c; color: white; text-decoration: none; border-radius: 6px;">Nová rezervácia</a></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Strojček Barber Shop</p>
</body>
</html>`;
}

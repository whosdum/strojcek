import nodemailer from "nodemailer";

const transporter =
  process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : null;

const EMAIL_FROM =
  process.env.EMAIL_FROM || "Strojcek <barbershopstrojcek@gmail.com>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  if (!transporter) {
    console.log("[EMAIL STUB]", { to, subject, html: html.substring(0, 200) + "..." });
    return { success: true, stub: true };
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      replyTo: EMAIL_FROM,
      to,
      subject,
      html,
      text: text || htmlToPlainText(html),
      headers: {
        "X-Mailer": "Strojcek Booking",
        "List-Unsubscribe": `<mailto:${process.env.SMTP_USER || "barbershopstrojcek@gmail.com"}?subject=unsubscribe>`,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("[EMAIL ERROR]", err);
    return { success: false, error: err };
  }
}

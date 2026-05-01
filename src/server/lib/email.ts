import nodemailer from "nodemailer";

// On Cloud Run / App Hosting K_SERVICE is set; locally it isn't.
// In production we must NOT silently no-op when SMTP credentials are
// missing — that would tell the customer "rezervácia úspešná" while
// the email never actually leaves the server.
const isProd =
  process.env.NODE_ENV === "production" || !!process.env.K_SERVICE;

if (isProd && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
  console.error(
    "[email] SMTP_USER or SMTP_PASS missing in production — sendEmail will fail"
  );
}

const transporter =
  process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        requireTLS: true,
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
    if (isProd) {
      // Hard fail in production rather than pretending success — the
      // caller (booking flow) needs to know the email did not go.
      return {
        success: false,
        error: new Error("SMTP transporter not configured"),
      };
    }
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

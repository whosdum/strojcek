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
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!transporter) {
    console.log("[EMAIL STUB]", { to, subject, html: html.substring(0, 200) + "..." });
    return { success: true, stub: true };
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error("[EMAIL ERROR]", err);
    return { success: false, error: err };
  }
}

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM = process.env.EMAIL_FROM || "Strojcek <noreply@strojcek.sk>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!resend) {
    console.log("[EMAIL STUB]", { to, subject, html: html.substring(0, 200) + "..." });
    return { success: true, stub: true };
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[EMAIL ERROR]", error);
    return { success: false, error };
  }

  return { success: true };
}

"use server";

import { getSession } from "@/server/lib/auth";
import { sendEmail } from "@/server/lib/email";
import {
  extractSendError,
  recordNotification,
} from "@/server/lib/notification-log";
import { marketingComebackHtml } from "@/emails/marketing-comeback";
import {
  MARKETING_TEMPLATES,
  MARKETING_SEND_DELAY_MS,
  MAX_MARKETING_RECIPIENTS,
  type MarketingTemplateId,
} from "@/lib/marketing-templates";
import { revalidatePath } from "next/cache";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEMPLATE_HTML: Record<MarketingTemplateId, () => string> = {
  comeback: marketingComebackHtml,
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface MarketingSendResult {
  success: boolean;
  error?: string;
  sent: number;
  failed: number;
  total: number;
  failures: Array<{ recipient: string; error: string }>;
}

export async function sendMarketingEmail(input: {
  templateId: MarketingTemplateId;
  recipients: string[];
}): Promise<MarketingSendResult> {
  if (!(await getSession())) {
    return {
      success: false,
      error: "Neautorizovaný prístup.",
      sent: 0,
      failed: 0,
      total: 0,
      failures: [],
    };
  }

  const template = MARKETING_TEMPLATES.find((t) => t.id === input.templateId);
  if (!template) {
    return {
      success: false,
      error: "Neznáma šablóna.",
      sent: 0,
      failed: 0,
      total: 0,
      failures: [],
    };
  }

  const cleaned = Array.from(
    new Set(
      input.recipients
        .map((r) => r.trim().toLowerCase())
        .filter((r) => r.length > 0)
    )
  );

  const invalid = cleaned.filter((e) => !EMAIL_REGEX.test(e));
  if (invalid.length > 0) {
    return {
      success: false,
      error: `Neplatné adresy: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}`,
      sent: 0,
      failed: 0,
      total: 0,
      failures: [],
    };
  }

  if (cleaned.length === 0) {
    return {
      success: false,
      error: "Zadajte aspoň jednu emailovú adresu.",
      sent: 0,
      failed: 0,
      total: 0,
      failures: [],
    };
  }

  if (cleaned.length > MAX_MARKETING_RECIPIENTS) {
    return {
      success: false,
      error: `Maximálne ${MAX_MARKETING_RECIPIENTS} adries naraz (zadali ste ${cleaned.length}).`,
      sent: 0,
      failed: 0,
      total: 0,
      failures: [],
    };
  }

  const html = TEMPLATE_HTML[template.id]();
  let sent = 0;
  let failed = 0;
  const failures: Array<{ recipient: string; error: string }> = [];

  // Sequential with a fixed delay between sends. Free Gmail SMTP throttles
  // bursts; spacing them out keeps us well under any rate-limit threshold
  // and protects sender reputation. The delay lives BETWEEN sends, not
  // before the first one, so a single-recipient batch is instant.
  for (let i = 0; i < cleaned.length; i++) {
    const recipient = cleaned[i];
    if (i > 0) await sleep(MARKETING_SEND_DELAY_MS);

    const start = Date.now();
    const result = await sendEmail({
      to: recipient,
      subject: template.subject,
      html,
    }).catch((err) => ({ success: false, error: err }) as const);

    if (result.success) {
      sent++;
    } else {
      failed++;
      failures.push({
        recipient,
        error: extractSendError(result.error) ?? "neznáma chyba",
      });
    }

    await recordNotification({
      kind: "email-marketing",
      status: result.success ? "sent" : "failed",
      appointmentId: null,
      recipient,
      error: result.success ? null : extractSendError(result.error),
      durationMs: Date.now() - start,
      trigger: "manual",
    });
  }

  revalidatePath("/admin/notifications");
  revalidatePath("/admin/marketing");

  return {
    success: failed === 0,
    sent,
    failed,
    total: cleaned.length,
    failures,
  };
}

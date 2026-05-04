import { formatInTimeZone } from "date-fns-tz";
import { sk } from "date-fns/locale";
import { TIMEZONE } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResendButton } from "@/components/admin/resend-button";
import {
  resendConfirmationEmail,
  resendCancellationEmail,
} from "@/server/actions/notifications";
import {
  CheckCircle2Icon,
  ClockIcon,
  MailIcon,
  MessageSquareIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";
import type {
  AppointmentNotificationStatusView,
  AppointmentStatus,
} from "@/lib/types";

interface PanelProps {
  appointmentId: string;
  appointmentStatus: AppointmentStatus;
  status: AppointmentNotificationStatusView;
}

export function NotificationStatusPanel({
  appointmentId,
  appointmentStatus,
  status,
}: PanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifikácie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <Row
          icon={<MailIcon className="size-4" />}
          label="Potvrdzovací email"
          recipient={status.confirmation.recipient}
          sentAt={status.confirmation.sentAt}
          error={status.confirmation.error}
          attempts={status.confirmation.attempts}
          action={
            status.confirmation.recipient && appointmentStatus !== "CANCELLED"
              ? {
                  label: "Resend",
                  fn: resendConfirmationEmail.bind(null, appointmentId),
                }
              : null
          }
        />
        <Row
          icon={<XCircleIcon className="size-4" />}
          label="Email o zrušení"
          recipient={status.cancellation.recipient}
          sentAt={status.cancellation.sentAt}
          error={status.cancellation.error}
          attempts={status.cancellation.attempts}
          neutralWhenEmpty={
            appointmentStatus !== "CANCELLED"
              ? "Rezervácia nezrušená."
              : undefined
          }
          action={
            appointmentStatus === "CANCELLED" && status.cancellation.recipient
              ? {
                  label: "Resend",
                  fn: resendCancellationEmail.bind(null, appointmentId),
                }
              : null
          }
        />
        <ReminderRow
          icon={<MailIcon className="size-4" />}
          label="Pripomienka (email)"
          recipient={status.reminderEmail.recipient}
          sentAt={status.reminderEmail.sentAt}
          lockedAt={status.reminderEmail.lockedAt}
        />
        <ReminderRow
          icon={<MessageSquareIcon className="size-4" />}
          label="Pripomienka (SMS)"
          recipient={status.reminderSms.recipient}
          sentAt={status.reminderSms.sentAt}
          lockedAt={status.reminderSms.lockedAt}
        />
        <Row
          icon={<SendIcon className="size-4" />}
          label="Telegram alert"
          recipient={null}
          sentAt={status.telegram.sentAt}
          error={status.telegram.error}
          attempts={undefined}
          action={null}
          hideRecipient
        />
      </CardContent>
    </Card>
  );
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  recipient: string | null;
  sentAt: Date | null;
  error: string | null;
  attempts: number | undefined;
  action: { label: string; fn: () => Promise<{ success: boolean; error?: string }> } | null;
  neutralWhenEmpty?: string;
  hideRecipient?: boolean;
}

function Row(props: RowProps) {
  const {
    icon,
    label,
    recipient,
    sentAt,
    error,
    attempts,
    action,
    neutralWhenEmpty,
    hideRecipient,
  } = props;

  const state = error
    ? "failed"
    : sentAt
      ? "sent"
      : neutralWhenEmpty
        ? "neutral"
        : "pending";

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-1 items-start gap-2">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="space-y-0.5">
          <p className="font-medium">{label}</p>
          {state === "sent" && sentAt && (
            <p className="text-muted-foreground text-xs">
              Poslané {formatInTimeZone(sentAt, TIMEZONE, "d.M.yyyy HH:mm", { locale: sk })}
              {!hideRecipient && recipient && ` · ${recipient}`}
              {attempts && attempts > 1 && ` · ${attempts}× pokusov`}
            </p>
          )}
          {state === "failed" && (
            <p className="text-destructive text-xs" title={error ?? undefined}>
              ✗ {error?.slice(0, 80) ?? "Chyba pri odoslaní"}
              {attempts && attempts > 1 && ` (${attempts}× pokusov)`}
            </p>
          )}
          {state === "pending" && (
            <p className="text-muted-foreground text-xs">— Žiadny pokus</p>
          )}
          {state === "neutral" && (
            <p className="text-muted-foreground text-xs">— {neutralWhenEmpty}</p>
          )}
        </div>
      </div>
      {action && <ResendButton action={action.fn} label={action.label} />}
    </div>
  );
}

interface ReminderRowProps {
  icon: React.ReactNode;
  label: string;
  recipient: string | null;
  sentAt: Date | null;
  lockedAt: Date | null;
}

function ReminderRow({ icon, label, recipient, sentAt, lockedAt }: ReminderRowProps) {
  const state = sentAt
    ? "sent"
    : lockedAt
      ? "locked"
      : recipient
        ? "pending"
        : "na";

  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="space-y-0.5">
        <p className="font-medium">{label}</p>
        {state === "sent" && sentAt && (
          <p className="text-muted-foreground text-xs">
            <CheckCircle2Icon className="mr-1 inline size-3" />
            Poslané {formatInTimeZone(sentAt, TIMEZONE, "d.M.yyyy HH:mm", { locale: sk })}
            {recipient && ` · ${recipient}`}
          </p>
        )}
        {state === "locked" && lockedAt && (
          <p className="text-muted-foreground text-xs">
            <ClockIcon className="mr-1 inline size-3" />
            Locked (cron beží alebo zaseknutý) od{" "}
            {formatInTimeZone(lockedAt, TIMEZONE, "d.M.yyyy HH:mm", { locale: sk })}
          </p>
        )}
        {state === "pending" && (
          <p className="text-muted-foreground text-xs">
            — Čaká (pošle sa cez nočný reminder cron)
          </p>
        )}
        {state === "na" && (
          <p className="text-muted-foreground text-xs">
            — Nedostupné (zákazník nemá {label.includes("SMS") ? "telefón" : "email"})
          </p>
        )}
      </div>
    </div>
  );
}

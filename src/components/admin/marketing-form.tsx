"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2Icon, SendIcon, AlertTriangleIcon } from "lucide-react";
import { toast } from "sonner";
import {
  MARKETING_TEMPLATES,
  MAX_MARKETING_RECIPIENTS,
  type MarketingTemplateId,
} from "@/lib/marketing-templates";
import { sendMarketingEmail } from "@/server/actions/marketing";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipients(raw: string): {
  valid: string[];
  invalid: string[];
} {
  const tokens = raw
    .split(/[,;\s\n]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (EMAIL_REGEX.test(t)) valid.push(t);
    else invalid.push(t);
  }
  return { valid, invalid };
}

export function MarketingForm() {
  const [templateId, setTemplateId] = useState<MarketingTemplateId>("comeback");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { valid, invalid } = useMemo(
    () => parseRecipients(recipientsRaw),
    [recipientsRaw]
  );

  const template = MARKETING_TEMPLATES.find((t) => t.id === templateId)!;
  const overLimit = valid.length > MAX_MARKETING_RECIPIENTS;
  const canSend =
    valid.length > 0 && invalid.length === 0 && !overLimit && !isPending;

  const handleSubmit = () => {
    if (!canSend) return;
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    startTransition(async () => {
      const r = await sendMarketingEmail({
        templateId,
        recipients: valid,
      });
      if (!r.success && r.error) {
        toast.error(r.error);
        return;
      }
      if (r.failed === 0) {
        toast.success(`Odoslané: ${r.sent} z ${r.total}.`);
        setRecipientsRaw("");
      } else {
        const firstFailures = r.failures
          .slice(0, 3)
          .map((f) => f.recipient)
          .join(", ");
        toast.error(
          `Hotovo s chybami: ${r.sent}/${r.total} OK, ${r.failed} zlyhalo (${firstFailures}${r.failures.length > 3 ? "…" : ""})`
        );
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="template">Šablóna</Label>
        <Select
          items={Object.fromEntries(
            MARKETING_TEMPLATES.map((t) => [t.id, t.label])
          )}
          value={templateId}
          onValueChange={(v) => setTemplateId(v as MarketingTemplateId)}
          disabled={isPending}
        >
          <SelectTrigger id="template" className="w-full sm:w-[280px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MARKETING_TEMPLATES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{template.description}</p>
        <p className="text-xs text-muted-foreground">
          Predmet:{" "}
          <span className="font-medium text-foreground">{template.subject}</span>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipients">Príjemcovia</Label>
        <Textarea
          id="recipients"
          value={recipientsRaw}
          onChange={(e) => setRecipientsRaw(e.target.value)}
          rows={6}
          disabled={isPending}
          placeholder={"jano@example.com, peter@example.com\nfero@example.com"}
          className="font-mono text-sm"
        />
        <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Oddeľte čiarkou, bodkočiarkou, medzerou alebo novým riadkom. Duplikáty sa odstránia.
          </p>
          <p
            className={
              overLimit || invalid.length > 0
                ? "text-destructive font-medium"
                : "text-muted-foreground"
            }
          >
            {valid.length} platných
            {invalid.length > 0 && ` · ${invalid.length} neplatných`}
            {overLimit && ` · max ${MAX_MARKETING_RECIPIENTS}`}
          </p>
        </div>
        {invalid.length > 0 && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Neplatné adresy: {invalid.slice(0, 5).join(", ")}
            {invalid.length > 5 && ` (+${invalid.length - 5} ďalších)`}
          </p>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Každý príjemca dostane samostatný email (nie BCC), aby si nikto nevidel ostatné adresy.
          Posielame postupne s 1s rozostupom (kvôli Gmail rate-limitu) — {valid.length || "N"} adries
          ≈ {valid.length > 0 ? `${valid.length} s` : "pár sekúnd"}.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!canSend}>
          {isPending ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <SendIcon className="mr-2 size-4" />
          )}
          Poslať {valid.length > 0 ? `(${valid.length})` : ""}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odoslať marketing email?</AlertDialogTitle>
            <AlertDialogDescription>
              Pošle sa <strong>{valid.length} email</strong>
              {valid.length === 1 ? "" : valid.length < 5 ? "y" : "ov"} so šablónou{" "}
              <strong>{template.label}</strong>. Odoslanie sa nedá vrátiť späť.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Áno, poslať teraz
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

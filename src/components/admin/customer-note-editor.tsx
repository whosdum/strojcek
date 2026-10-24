"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerNotes } from "@/server/actions/customers";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";

interface CustomerNoteEditorProps {
  customerId: string;
  notes: string | null;
}

/** Admin-only customer note, editable in place on the reservation detail. */
export function CustomerNoteEditor({ customerId, notes }: CustomerNoteEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes ?? "");
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateCustomerNotes(customerId, value);
      if (result.success) {
        toast.success("Poznámka bola uložená.");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error || "Nastala chyba.");
      }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Interná poznámka o zákazníkovi</span>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <PencilIcon className="mr-1 size-4" />
            {notes ? "Upraviť" : "Pridať"}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            rows={3}
            maxLength={1000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Napr. kto to je, čo zvykne chcieť…"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Ukladám..." : "Uložiť"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setValue(notes ?? "");
                setEditing(false);
              }}
              disabled={isPending}
            >
              Zrušiť
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap break-words">
          {notes || <span className="text-muted-foreground">—</span>}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Zákazník túto poznámku nevidí.</p>
    </div>
  );
}

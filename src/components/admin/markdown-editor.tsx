"use client";

import { useRef, useTransition, type RefObject } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/blog/markdown-renderer";
import { computeReadingMinutes } from "@/lib/reading-time";
import { uploadBlogImageAction } from "@/server/actions/blog";
import { toast } from "sonner";
import {
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  Heading2Icon,
  QuoteIcon,
  ImageIcon,
  ImageUpIcon,
  CodeIcon,
  Loader2Icon,
} from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  placeholder?: string;
  /** Slug used as the Storage folder prefix for inline images. Empty
   * string is accepted — the server action falls back to "_drafts". */
  slug?: string;
}

// Mutator return type — describes a text replacement on the textarea
// rather than a wholesale value swap. apply() uses this to drive an
// `execCommand("insertText")` call so the browser's native undo stack
// stays intact (React-controlled value swaps would break Ctrl+Z).
type MutatorResult = {
  replaceFrom: number;
  replaceTo: number;
  newText: string;
  newSelectionStart: number;
  newSelectionEnd: number;
};

// Wrap selection (or cursor position) with `before`/`after` markers. If a
// placeholder is given and there is no selection, insert it between the
// markers so the user sees what the syntax will affect.
function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = ""
): MutatorResult {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const inner = selected.length > 0 ? selected : placeholder;
  return {
    replaceFrom: selectionStart,
    replaceTo: selectionEnd,
    newText: before + inner + after,
    newSelectionStart: selectionStart + before.length,
    newSelectionEnd: selectionStart + before.length + inner.length,
  };
}

function insertAtLineStart(
  textarea: HTMLTextAreaElement,
  prefix: string
): MutatorResult {
  const { selectionStart, value } = textarea;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  return {
    replaceFrom: lineStart,
    replaceTo: lineStart,
    newText: prefix,
    newSelectionStart: selectionStart + prefix.length,
    newSelectionEnd: selectionStart + prefix.length,
  };
}

interface WritePaneProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  textareaId?: string;
  placeholder: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  slug: string;
}

// Toolbar + textarea pair. Used by both the mobile Tabs view and the
// desktop split view; each instance owns its own ref so the apply()
// function targets the visible textarea.
function WritePane({
  textareaRef,
  value,
  onChange,
  rows,
  textareaId,
  placeholder,
  ariaInvalid,
  ariaDescribedBy,
  slug,
}: WritePaneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();

  const apply = (mutator: (ta: HTMLTextAreaElement) => MutatorResult) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const result = mutator(ta);
    ta.focus();
    ta.setSelectionRange(result.replaceFrom, result.replaceTo);
    // execCommand("insertText") is the only programmatic insertion that
    // keeps the browser's native undo stack alive. Direct value mutation
    // via React setState would let users type — but break Ctrl+Z the
    // moment they use a toolbar button. Deprecated on paper, still
    // universally supported, and there's no modern replacement for
    // contenteditable=false elements.
    document.execCommand("insertText", false, result.newText);
    requestAnimationFrame(() => {
      ta.setSelectionRange(result.newSelectionStart, result.newSelectionEnd);
    });
  };

  const handleInlineUpload = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Obrázok je príliš veľký. Max 10 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Povolené formáty: JPG, PNG, WebP.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slug", slug);
    fd.append("kind", "inline");
    startUpload(async () => {
      try {
        const result = await uploadBlogImageAction(fd);
        if (result.success) {
          apply((ta) =>
            wrapSelection(ta, "![", `](${result.url})`, "popis obrázka")
          );
          toast.success("Obrázok bol nahraný a vložený.");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Nahranie obrázka zlyhalo.");
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Nadpis"
          onClick={() => apply((ta) => insertAtLineStart(ta, "## "))}
        >
          <Heading2Icon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Tučné"
          onClick={() => apply((ta) => wrapSelection(ta, "**", "**", "tučné"))}
        >
          <BoldIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Kurzíva"
          onClick={() => apply((ta) => wrapSelection(ta, "*", "*", "kurzíva"))}
        >
          <ItalicIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Kód"
          onClick={() => apply((ta) => wrapSelection(ta, "`", "`", "kod"))}
        >
          <CodeIcon className="size-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoznam"
          onClick={() => apply((ta) => insertAtLineStart(ta, "- "))}
        >
          <ListIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Číslovaný zoznam"
          onClick={() => apply((ta) => insertAtLineStart(ta, "1. "))}
        >
          <ListOrderedIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Citácia"
          onClick={() => apply((ta) => insertAtLineStart(ta, "> "))}
        >
          <QuoteIcon className="size-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Odkaz"
          onClick={() =>
            apply((ta) => wrapSelection(ta, "[", "](https://)", "text odkazu"))
          }
        >
          <LinkIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Obrázok (URL)"
          title="Vložiť obrázok pomocou URL"
          onClick={() =>
            apply((ta) =>
              wrapSelection(ta, "![", "](https://)", "popis obrázka")
            )
          }
        >
          <ImageIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Nahrať obrázok zo zariadenia"
          title="Nahrať obrázok zo zariadenia"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <ImageUpIcon className="size-4" />
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleInlineUpload(file);
            e.target.value = "";
          }}
        />
      </div>
      <Textarea
        ref={textareaRef}
        id={textareaId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="font-mono text-[13px] leading-relaxed"
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
    </div>
  );
}

function PreviewPane({ value }: { value: string }) {
  if (value.trim().length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Najprv niečo napíšte vľavo a náhľad sa zobrazí tu.
      </p>
    );
  }
  return <MarkdownRenderer content={value} />;
}

export function MarkdownEditor({
  value,
  onChange,
  rows = 16,
  id,
  placeholder = "# Nadpis\n\nText odseku...\n\n- Bod zoznamu\n- Ďalší bod",
  slug = "",
  ...rest
}: MarkdownEditorProps) {
  // Two refs because both render branches exist in the DOM simultaneously;
  // each WritePane's toolbar must target its own textarea even though only
  // one is visible at any viewport size.
  const mobileRef = useRef<HTMLTextAreaElement>(null);
  const desktopRef = useRef<HTMLTextAreaElement>(null);

  const readingMinutes = computeReadingMinutes(value);
  const charCount = value.length;

  return (
    <div className="w-full">
      {/* Mobile / tablet — tabs */}
      <Tabs defaultValue="write" className="w-full lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="write">Písať</TabsTrigger>
            <TabsTrigger value="preview">Náhľad</TabsTrigger>
          </TabsList>
          <span className="text-xs text-muted-foreground">
            {charCount} znakov · {readingMinutes} min čítania
          </span>
        </div>

        <TabsContent value="write" className="mt-2">
          <WritePane
            textareaRef={mobileRef}
            value={value}
            onChange={onChange}
            rows={rows}
            textareaId={id}
            placeholder={placeholder}
            ariaInvalid={rest["aria-invalid"]}
            ariaDescribedBy={rest["aria-describedby"]}
            slug={slug}
          />
        </TabsContent>

        <TabsContent
          value="preview"
          className="mt-2 min-h-[300px] rounded-md border bg-card p-5"
        >
          <PreviewPane value={value} />
        </TabsContent>
      </Tabs>

      {/* Desktop — side-by-side editor + preview */}
      <div className="hidden lg:block">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">
            Obsah a živý náhľad
          </span>
          <span className="text-muted-foreground">
            {charCount} znakov · {readingMinutes} min čítania
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <WritePane
            textareaRef={desktopRef}
            value={value}
            onChange={onChange}
            rows={Math.max(rows, 18)}
            placeholder={placeholder}
            ariaInvalid={rest["aria-invalid"]}
            ariaDescribedBy={rest["aria-describedby"]}
            slug={slug}
          />
          <div className="min-h-[420px] rounded-md border bg-card p-5">
            <PreviewPane value={value} />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Loader2Icon, UploadCloudIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { uploadBlogImageAction } from "@/server/actions/blog";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  /** Current uploaded path (used to disable upload UI when one already
   * exists). Pass null/undefined when slot is empty. */
  path: string | null;
  /** Current URL — also pass the previewable URL through this component
   * so it can render the thumbnail without external state. */
  url: string | null;
  onChange: (next: { url: string | null; path: string | null }) => void;
  /** Slug used as the Storage path prefix. Falls back to "_drafts" on the
   * server if blank, but we forward whatever the form has so saves carry
   * the right folder. */
  slug: string;
  kind?: "cover" | "inline";
  className?: string;
}

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

export function ImageUploader({
  path,
  url,
  onChange,
  slug,
  kind = "cover",
  className,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file.size > MAX_BYTES) {
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
    fd.append("kind", kind);
    startTransition(async () => {
      try {
        const result = await uploadBlogImageAction(fd);
        if (result.success) {
          onChange({ url: result.url, path: result.path });
          toast.success("Obrázok bol nahraný.");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Nahranie obrázka zlyhalo.");
      }
    });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isPending) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const remove = () => {
    onChange({ url: null, path: null });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {url ? (
        <div className="overflow-hidden rounded-md border border-border/60 bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Nahraný obrázok"
            className="aspect-[16/9] w-full object-cover"
          />
          <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-card p-2">
            <span className="truncate text-xs text-muted-foreground">
              {path ?? url}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => inputRef.current?.click()}
              >
                {isPending && (
                  <Loader2Icon className="mr-2 size-3.5 animate-spin" />
                )}
                Nahradiť
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={remove}
                aria-label="Odstrániť obrázok"
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !isPending && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isPending) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-busy={isPending}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed bg-muted/30 p-6 text-center transition",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border/70 hover:bg-muted/50",
            isPending && "pointer-events-none opacity-60"
          )}
        >
          {isPending ? (
            <Loader2Icon className="mb-2 size-6 animate-spin text-muted-foreground" />
          ) : (
            <UploadCloudIcon className="mb-2 size-6 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {isPending
              ? "Nahrávam…"
              : "Pretiahni obrázok sem alebo klikni pre výber"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPG, PNG alebo WebP · max 10 MB
          </p>
        </div>
      )}
    </div>
  );
}

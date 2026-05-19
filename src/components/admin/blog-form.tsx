"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { blogPostInputSchema, type BlogPostInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBlogPost, updateBlogPost } from "@/server/actions/blog";
import { toast } from "sonner";
import { slugify } from "@/lib/slugify";
import type { BlogPostView } from "@/lib/types";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { ImageUploader } from "@/components/admin/image-uploader";

interface BlogFormProps {
  post?: BlogPostView;
  onClose?: () => void;
}

function tagsToString(tags: string[]): string {
  return tags.join(", ");
}

function stringToTags(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function BlogForm({ post, onClose }: BlogFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!post;
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEdit);
  const [tagsInput, setTagsInput] = useState(tagsToString(post?.tags ?? []));

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BlogPostInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(blogPostInputSchema) as any,
    defaultValues: {
      slug: post?.slug ?? "",
      title: post?.title ?? "",
      excerpt: post?.excerpt ?? "",
      content: post?.content ?? "",
      coverImageUrl: post?.coverImageUrl ?? null,
      coverImagePath: post?.coverImagePath ?? null,
      coverImageAlt: post?.coverImageAlt ?? null,
      tags: post?.tags ?? [],
      status: post?.status ?? "DRAFT",
    },
  });

  const titleValue = watch("title");
  const slugValue = watch("slug");
  const contentValue = watch("content");
  const coverImageUrlValue = watch("coverImageUrl");
  const coverImagePathValue = watch("coverImagePath");

  const submit = (statusOverride?: "DRAFT" | "PUBLISHED") => {
    handleSubmit((data) => {
      const finalData = {
        ...data,
        tags: stringToTags(tagsInput),
        status: statusOverride ?? data.status,
      };
      startTransition(async () => {
        try {
          const result = isEdit
            ? await updateBlogPost(post.slug, finalData)
            : await createBlogPost(finalData);
          if (result.success) {
            toast.success(
              finalData.status === "PUBLISHED"
                ? "Článok bol publikovaný"
                : "Koncept bol uložený"
            );
            router.refresh();
            onClose?.();
          } else {
            toast.error(result.error ?? "Nepodarilo sa uložiť článok");
          }
        } catch {
          toast.error("Nepodarilo sa uložiť článok");
        }
      });
    })();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="title">Názov *</Label>
        <Input
          id="title"
          aria-required
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : undefined}
          {...register("title")}
          onChange={(e) => {
            setValue("title", e.target.value);
            if (!slugManuallyEdited) {
              setValue("slug", slugify(e.target.value));
            }
          }}
        />
        {errors.title && (
          <p id="title-error" className="text-xs text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slug">Slug (URL) *</Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">/blog/</span>
          <Input
            id="slug"
            disabled={isEdit}
            aria-invalid={!!errors.slug}
            aria-describedby={errors.slug ? "slug-error" : undefined}
            {...register("slug")}
            onChange={(e) => {
              setSlugManuallyEdited(true);
              setValue("slug", slugify(e.target.value));
            }}
          />
        </div>
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            Slug pri editácii nie je možné zmeniť.
          </p>
        )}
        {errors.slug && (
          <p id="slug-error" className="text-xs text-destructive">
            {errors.slug.message}
          </p>
        )}
        {!isEdit && titleValue && slugValue && (
          <p className="text-xs text-muted-foreground">
            Náhľad: <span className="font-mono">/blog/{slugValue}</span>
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="excerpt">Krátky popis (meta description) *</Label>
        <Textarea
          id="excerpt"
          rows={3}
          aria-invalid={!!errors.excerpt}
          aria-describedby={errors.excerpt ? "excerpt-error" : undefined}
          {...register("excerpt")}
        />
        {errors.excerpt && (
          <p id="excerpt-error" className="text-xs text-destructive">
            {errors.excerpt.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tags">Tagy (oddelené čiarkou)</Label>
        <Input
          id="tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="novinky, tipy, barberstvo"
        />
        <p className="text-xs text-muted-foreground">
          Max 8 tagov, každý do 30 znakov.
        </p>
      </div>

      <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3.5">
        <div>
          <Label>Náhľadový obrázok (cover)</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Zobrazí sa ako veľký obrázok nad titulkom článku a v zozname /blog.
            Nahraj súbor priamo (drag-and-drop) alebo vlož externú URL nižšie.
          </p>
        </div>

        <ImageUploader
          path={coverImagePathValue ?? null}
          url={coverImagePathValue ? (coverImageUrlValue ?? null) : null}
          slug={slugValue || post?.slug || ""}
          kind="cover"
          onChange={({ url, path }) => {
            setValue("coverImageUrl", url, { shouldValidate: true });
            setValue("coverImagePath", path, { shouldValidate: true });
          }}
        />

        <details className="rounded-md border border-border/40 bg-card/40 px-3 py-2 text-xs">
          <summary className="cursor-pointer select-none font-medium text-muted-foreground">
            Alebo použiť externú URL
          </summary>
          <div className="mt-2 space-y-2">
            <Input
              id="coverImageUrl"
              type="url"
              placeholder="https://…"
              defaultValue={coverImagePathValue ? "" : (coverImageUrlValue ?? "")}
              onChange={(e) => {
                const trimmed = e.target.value.trim();
                setValue("coverImageUrl", trimmed.length === 0 ? null : trimmed, {
                  shouldValidate: true,
                });
                // External URL → drop the Storage path so the cleanup
                // logic doesn't try to delete a file we don't own.
                setValue("coverImagePath", null);
              }}
            />
            {errors.coverImageUrl && (
              <p className="text-xs text-destructive">
                {errors.coverImageUrl.message}
              </p>
            )}
          </div>
        </details>

        <div className="space-y-1.5">
          <Label htmlFor="coverImageAlt" className="text-xs">
            Alt text (popis pre čítačky obrazovky a SEO)
          </Label>
          <Input
            id="coverImageAlt"
            placeholder="napr. Holičstvo Strojček v Bytči — interiér"
            {...register("coverImageAlt", {
              setValueAs: (v) => {
                if (typeof v !== "string") return v;
                const trimmed = v.trim();
                return trimmed.length === 0 ? null : trimmed;
              },
            })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="content">Obsah (markdown) *</Label>
        <MarkdownEditor
          id="content"
          value={contentValue ?? ""}
          onChange={(v) => setValue("content", v, { shouldValidate: true })}
          aria-invalid={!!errors.content}
          aria-describedby={errors.content ? "content-error" : undefined}
          slug={slugValue || post?.slug || ""}
        />
        {errors.content && (
          <p id="content-error" className="text-xs text-destructive">
            {errors.content.message}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        {onClose && (
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Zrušiť
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => submit("DRAFT")}
          className="w-full sm:w-auto"
        >
          {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          Uložiť koncept
        </Button>
        <Button
          type="button"
          disabled={isPending}
          onClick={() => submit("PUBLISHED")}
          className="w-full sm:w-auto"
        >
          {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {post?.status === "PUBLISHED" ? "Uložiť zmeny" : "Publikovať"}
        </Button>
      </div>
    </form>
  );
}

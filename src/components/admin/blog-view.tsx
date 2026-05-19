"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BlogPostView, BlogPostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BlogForm } from "@/components/admin/blog-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusIcon, PencilIcon, Trash2Icon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { deleteBlogPost, toggleBlogPostStatus } from "@/server/actions/blog";
import { toast } from "sonner";

interface BlogViewProps {
  posts: BlogPostView[];
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

// Segmented radio toggle for DRAFT / PUBLISHED status. Clicking the
// already-selected option is a no-op; clicking the other one fires
// `onChange` which opens a confirm dialog before mutating.
function StatusToggle({
  status,
  onChange,
  size = "md",
}: {
  status: BlogPostStatus;
  onChange: (next: BlogPostStatus) => void;
  size?: "sm" | "md";
}) {
  const isPublished = status === "PUBLISHED";
  const padding =
    size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11px]";
  return (
    <div
      role="radiogroup"
      aria-label="Stav článku"
      className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 p-0.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="radio"
        aria-checked={!isPublished}
        onClick={() => isPublished && onChange("DRAFT")}
        className={cn(
          "rounded-full font-semibold uppercase tracking-wider transition-colors",
          padding,
          !isPublished
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Koncept
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={isPublished}
        onClick={() => !isPublished && onChange("PUBLISHED")}
        className={cn(
          "rounded-full font-semibold uppercase tracking-wider transition-colors",
          padding,
          isPublished
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Publikovaný
      </button>
    </div>
  );
}

export function BlogView({ posts }: BlogViewProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editPost, setEditPost] = useState<BlogPostView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlogPostView | null>(null);
  const [statusTarget, setStatusTarget] = useState<BlogPostView | null>(null);
  const [, startTransition] = useTransition();

  const handleEdit = (post: BlogPostView) => {
    setEditPost(post);
    setOpen(true);
  };

  const handleNew = () => {
    setEditPost(null);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditPost(null);
    router.refresh();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const slug = deleteTarget.slug;
    startTransition(async () => {
      const result = await deleteBlogPost(slug);
      if (result.success) {
        toast.success("Článok bol zmazaný");
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Mazanie zlyhalo");
      }
    });
  };

  const confirmToggleStatus = () => {
    if (!statusTarget) return;
    const post = statusTarget;
    startTransition(async () => {
      const result = await toggleBlogPostStatus(post.slug);
      if (result.success) {
        toast.success(
          post.status === "PUBLISHED"
            ? "Článok zmenený na koncept"
            : "Článok publikovaný"
        );
        setStatusTarget(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Zmena stavu zlyhala");
      }
    });
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Spravujte články, ktoré sa zobrazujú na /blog.
          </p>
        </div>
        <Button size="sm" onClick={handleNew}>
          <PlusIcon className="mr-1 size-4" />
          Pridať článok
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto lg:max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {editPost ? "Upraviť článok" : "Nový článok"}
            </DialogTitle>
          </DialogHeader>
          <BlogForm post={editPost ?? undefined} onClose={handleClose} />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať článok?</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete zmazať článok „{deleteTarget?.title}“? Akcia sa
              nedá vrátiť.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!statusTarget}
        onOpenChange={(o) => !o && setStatusTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.status === "PUBLISHED"
                ? "Stiahnuť z webu?"
                : "Publikovať článok?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.status === "PUBLISHED"
                ? `Článok „${statusTarget?.title}“ sa zmení na koncept a prestane sa zobrazovať na /blog a v sitemap.`
                : `Článok „${statusTarget?.title}“ sa zverejní na /blog a pridá sa do sitemap pre Google.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleStatus}>
              {statusTarget?.status === "PUBLISHED"
                ? "Stiahnuť"
                : "Publikovať"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {posts.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Žiadne články. Pridajte prvý článok.
        </p>
      ) : null}

      {/* Mobile cards */}
      <div className={posts.length === 0 ? "hidden" : "space-y-3 md:hidden"}>
        {posts.map((post) => (
          <div key={post.slug} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{post.title}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  /{post.slug}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleEdit(post)}
                  aria-label="Upraviť"
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleteTarget(post)}
                  aria-label="Zmazať"
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <StatusToggle
                status={post.status}
                onChange={() => setStatusTarget(post)}
                size="sm"
              />
              <Link
                href={`/blog/${post.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-strong hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLinkIcon className="size-3" />
                {post.status === "PUBLISHED" ? "Otvoriť" : "Náhľad"}
              </Link>
              {post.tags.slice(0, 3).map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
              <Badge variant="outline">
                {formatDate(post.publishedAt ?? post.updatedAt)}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className={posts.length === 0 ? "hidden" : "hidden md:block"}>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">Názov</TableHead>
              <TableHead className="w-[14%]">Tagy</TableHead>
              <TableHead className="w-[22%]">Stav</TableHead>
              <TableHead className="w-[14%]">Publikované</TableHead>
              <TableHead className="w-[16%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow
                key={post.slug}
                tabIndex={0}
                role="button"
                aria-label={`Upraviť článok ${post.title}`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button,a")) return;
                  handleEdit(post);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    if ((e.target as HTMLElement).closest("button,a")) return;
                    e.preventDefault();
                    handleEdit(post);
                  }
                }}
                className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{post.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      /{post.slug}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {post.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                    {post.tags.length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusToggle
                    status={post.status}
                    onChange={() => setStatusTarget(post)}
                    size="sm"
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(post.publishedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={
                        post.status === "PUBLISHED"
                          ? "Otvoriť článok na webe"
                          : "Zobraziť náhľad konceptu"
                      }
                      title={
                        post.status === "PUBLISHED"
                          ? "Otvoriť článok"
                          : "Náhľad konceptu"
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLinkIcon className="size-4" />
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Upraviť článok"
                      onClick={() => handleEdit(post)}
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Zmazať článok"
                      onClick={() => setDeleteTarget(post)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

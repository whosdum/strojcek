import Link from "next/link";
import { getAllBlogPosts } from "@/server/queries/blog";
import { BlogView } from "@/components/admin/blog-view";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">
          Dashboard
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground" aria-current="page">
          Blog
        </span>
      </nav>
      <BlogView posts={posts} />
    </div>
  );
}

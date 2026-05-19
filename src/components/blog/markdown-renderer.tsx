import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import Image from "next/image";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// react-markdown component overrides — styled with Tailwind to match the
// site's existing typography (compact headings, primary-color links). Kept
// component-level instead of using @tailwindcss/typography so we don't pull
// in another dependency for ~5 elements.
export function MarkdownRenderer({
  content,
  className = "",
}: MarkdownRendererProps) {
  return (
    <div className={`space-y-4 text-[15px] leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children }) => (
            <h2 className="mt-8 text-2xl font-bold tracking-tight first:mt-0">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h2 className="mt-8 text-xl font-bold tracking-tight first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 text-lg font-semibold tracking-tight">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-foreground/90">{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-primary-strong underline-offset-2 hover:underline"
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="ml-5 list-disc space-y-1.5 text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="ml-5 list-decimal space-y-1.5 text-foreground/90">
              {children}
            </ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children, className: cn }) => {
            const isInline = !cn;
            if (isInline) {
              return (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]">
                  {children}
                </code>
              );
            }
            return (
              <code className={`${cn} font-mono text-[13px]`}>{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-[13px] leading-relaxed">
              {children}
            </pre>
          ),
          img: ({ src, alt }) => {
            if (typeof src !== "string") return null;
            // width/height here act as an intrinsic-ratio hint (1600x900
            // = 16:9 default) and as the upper-bound source resolution
            // Next.js will request. `w-full h-auto` lets the rendered
            // size follow the natural image ratio after load, so portrait
            // or square uploads render correctly — the 16:9 reservation
            // costs at most a brief CLS on first paint.
            //
            // `sizes` matches the prose column max-width (~720px). On
            // desktop the optimizer serves a ~750px WebP variant (~80 KB
            // for a typical photo) instead of the 5–10 MB original.
            return (
              <Image
                src={src}
                alt={alt ?? ""}
                width={1600}
                height={900}
                sizes="(min-width: 1024px) 720px, 100vw"
                className="my-6 h-auto w-full rounded-xl border border-border/40"
              />
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border/60 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/30 px-3 py-2">{children}</td>
          ),
          hr: () => <hr className="my-6 border-border/40" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

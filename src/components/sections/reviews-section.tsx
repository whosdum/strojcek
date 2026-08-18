import { StarIcon } from "lucide-react";
import { PUBLIC_REVIEWS } from "@/lib/reviews-data";
import { SHOP_MAPS_URL } from "@/lib/business-info";
import { getAggregateRating } from "@/server/lib/google-rating";

interface ReviewsSectionProps {
  className?: string;
}

export async function ReviewsSection({
  className = "mt-8 rounded-2xl border border-border/40 bg-card/40 p-6 sm:p-8",
}: ReviewsSectionProps) {
  const rating = await getAggregateRating();

  return (
    <section aria-labelledby="recenzie" className={className}>
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="recenzie"
          className="text-lg font-bold tracking-tight sm:text-xl"
        >
          Čo o nás hovoria klienti
        </h2>
        <a
          href={SHOP_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[12px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Všetky recenzie →
        </a>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div
          role="img"
          aria-label={`Hodnotenie ${rating.ratingValue} z ${rating.bestRating}`}
          className="flex items-center gap-0.5"
        >
          {Array.from({ length: rating.bestRating }).map((_, i) => (
            <StarIcon
              key={i}
              aria-hidden="true"
              className={
                i < Math.round(rating.ratingValue)
                  ? "size-4 fill-amber-400 text-amber-400"
                  : "size-4 text-muted-foreground/40"
              }
            />
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">
            {rating.ratingValue.toFixed(1)}
          </span>{" "}
          z {rating.reviewCount} recenzií na Google
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {PUBLIC_REVIEWS.map((r) => (
          <article
            key={`${r.authorName}-${r.date}`}
            className="rounded-xl border border-border/40 bg-card/60 p-4"
          >
            <div className="flex items-center gap-1 text-amber-400">
              {Array.from({ length: r.rating }).map((_, i) => (
                <StarIcon
                  key={i}
                  aria-hidden="true"
                  className="size-3.5 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-foreground/90">
              {r.text}
            </p>
            <footer className="mt-3 text-[12px] text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {r.authorName}
              </span>{" "}
              ·{" "}
              <time dateTime={r.date}>
                {new Date(r.date).toLocaleDateString("sk-SK", {
                  year: "numeric",
                  month: "long",
                })}
              </time>{" "}
              ·{" "}
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  Z Google Reviews
                </a>
              ) : (
                "Z Google Reviews"
              )}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

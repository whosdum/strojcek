import { AGGREGATE_RATING } from "@/lib/reviews-data";

// Google Business Profile place ID pre Strojček Barbershop.
const PLACE_ID = "ChIJ0f0uR-RhFEcRPjwCKGNtqUI";

// Rating sa mení zriedka — 6h cache drží Places API usage hlboko pod free tierom.
const REVALIDATE_SECONDS = 6 * 60 * 60;

export interface AggregateRating {
  ratingValue: number;
  reviewCount: number;
  bestRating: number;
}

export async function getAggregateRating(): Promise<AggregateRating> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return AGGREGATE_RATING;
  }

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${PLACE_ID}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "rating,userRatingCount",
        },
        next: { revalidate: REVALIDATE_SECONDS },
      }
    );

    if (!response.ok) {
      console.error("[PLACES ERROR]", response.status, await response.text());
      return AGGREGATE_RATING;
    }

    const data: { rating?: number; userRatingCount?: number } =
      await response.json();

    if (
      typeof data.rating !== "number" ||
      typeof data.userRatingCount !== "number"
    ) {
      console.error("[PLACES ERROR] unexpected payload", data);
      return AGGREGATE_RATING;
    }

    return {
      ratingValue: data.rating,
      reviewCount: data.userRatingCount,
      bestRating: AGGREGATE_RATING.bestRating,
    };
  } catch (error) {
    console.error("[PLACES ERROR]", error);
    return AGGREGATE_RATING;
  }
}

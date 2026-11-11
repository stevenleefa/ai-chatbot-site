import { getServerSupabase, isSupabaseConfigured } from "./supabase";
import { seedPublicReviews, type PublicReview } from "./reviews";

// Server only (imports the service-role client — never import this
// file from a client component). Combines the approved visitor
// reviews from public.reviews with the seed reviews, newest first.
// When Supabase is not configured the list is just the seeds, so the
// Reviews section never starts empty.

// Approved reviews for the public list.
export async function getPublicReviews(): Promise<PublicReview[]> {
  const reviews: PublicReview[] = [...seedPublicReviews()];
  if (isSupabaseConfigured()) {
    const supabase = getServerSupabase();
    const { data, error } = await supabase!
      .from("reviews")
      .select("id, created_at, name, rating, text, service")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (!error && data) {
      for (const row of data) {
        reviews.push({
          id: row.id,
          name: row.name,
          rating: row.rating,
          text: row.text,
          service: row.service ?? null,
          createdAt: String(row.created_at).slice(0, 10),
          source: "visitor",
        });
      }
    }
  }
  return reviews.sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name)
  );
}

export type PendingReview = {
  id: string;
  name: string;
  rating: number;
  text: string;
  service: string | null;
  created_at: string;
};

// Pending reviews for the admin approvals list. Called from /admin
// after the admin role check — never from public code.
export async function getPendingReviews(): Promise<PendingReview[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getServerSupabase();
  const { data, error } = await supabase!
    .from("reviews")
    .select("id, created_at, name, rating, text, service")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as PendingReview[];
}

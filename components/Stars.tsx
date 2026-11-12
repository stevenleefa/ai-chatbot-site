import { stars } from "@/lib/reviews";

// Star rating for display: "★★★★★" with an aria-label, so a screen
// reader hears "4 out of 5 stars" instead of each star glyph read
// out loud. The filled stars use the dark chart gold (#8a6d1f,
// 4.90:1 on white; #d9b45b, 8.09:1 on dark in dark mode); the empty
// stars use the dark input-border brown (#97826f, 3.46:1) — both pass
// their WCAG bars (see the star CSS in globals.css).
export default function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="stars">
      {stars(rating)}
    </span>
  );
}

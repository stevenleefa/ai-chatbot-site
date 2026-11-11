import { avatarColour, initials } from "@/lib/reviews";

// Initials avatar — the "face icon" for a reviewer. No photos of
// real people: the reviewers are fictional / unknown, so a coloured
// circle with their initials is the honest avatar. White initials on
// the dark avatar colours pass WCAG 2.1 AA (see lib/reviews.ts).
// aria-hidden: the reviewer's name is the text right next to it.
export default function ReviewAvatar({ name }: { name: string }) {
  return (
    <span
      className="avatar"
      style={{ background: avatarColour(name) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

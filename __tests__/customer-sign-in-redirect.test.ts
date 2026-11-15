// The old customer sign-in address (/my-account/sign-in) no longer
// has a form: it redirects to the single sign-in (/login), keeping
// ?next= so bookmarked or redirected links still land where they
// were going. next/navigation's redirect() throws a NEXT_REDIRECT
// error carrying the destination in its digest — the page is invoked
// directly here and the thrown digest is asserted.
import CustomerSignInRedirect from "@/app/my-account/sign-in/page";

function redirectDigest(
  searchParams?: { next?: string | string[] }
): string | null {
  try {
    CustomerSignInRedirect({ searchParams });
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    return typeof digest === "string" ? digest : null;
  }
  return null;
}

describe("/my-account/sign-in redirects to the single sign-in", () => {
  it("redirects to /login when there is no next", () => {
    expect(redirectDigest()).toBe("NEXT_REDIRECT;replace;/login;307;");
    expect(redirectDigest({})).toBe("NEXT_REDIRECT;replace;/login;307;");
  });

  it("redirects to /login preserving ?next=", () => {
    expect(redirectDigest({ next: "/my-account" })).toBe(
      "NEXT_REDIRECT;replace;/login?next=%2Fmy-account;307;"
    );
    expect(redirectDigest({ next: "/settings" })).toBe(
      "NEXT_REDIRECT;replace;/login?next=%2Fsettings;307;"
    );
  });

  it("does not pass an unsafe next through to /login", () => {
    expect(redirectDigest({ next: "https://evil.example" })).toBe(
      "NEXT_REDIRECT;replace;/login;307;"
    );
  });
});

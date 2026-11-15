// postSignInDestination — where the single sign-in page (/login)
// sends a user right after sign-in. Pure function: role (from the
// profiles row) + ?next= in, destination out.
import { postSignInDestination } from "@/lib/auth/post-login";

describe("postSignInDestination", () => {
  it("customer with no next goes to /my-account", () => {
    expect(postSignInDestination("customer", null)).toBe("/my-account");
    expect(postSignInDestination("customer", undefined)).toBe("/my-account");
    expect(postSignInDestination("customer", "")).toBe("/my-account");
  });

  it("staff and admin with no next go to /dashboard", () => {
    expect(postSignInDestination("staff", null)).toBe("/dashboard");
    expect(postSignInDestination("admin", null)).toBe("/dashboard");
    expect(postSignInDestination("staff", "")).toBe("/dashboard");
  });

  it("a customer with next pointing at an owner page goes to /my-account, not the owner page", () => {
    for (const next of [
      "/dashboard",
      "/leads",
      "/admin",
      "/customers",
      "/appointments",
      "/employees",
      "/orders",
      "/profile",
      "/dashboard?tab=sales",
    ]) {
      expect(postSignInDestination("customer", next)).toBe("/my-account");
    }
  });

  it("a customer with next pointing at a customer or public page is sent there", () => {
    expect(postSignInDestination("customer", "/my-account")).toBe(
      "/my-account"
    );
    expect(postSignInDestination("customer", "/settings")).toBe("/settings");
    expect(postSignInDestination("customer", "/products")).toBe("/products");
    expect(postSignInDestination("customer", "/")).toBe("/");
  });

  it("staff and admin with next pointing at an owner page are sent there", () => {
    expect(postSignInDestination("staff", "/leads")).toBe("/leads");
    expect(postSignInDestination("staff", "/dashboard")).toBe("/dashboard");
    expect(postSignInDestination("admin", "/admin")).toBe("/admin");
    expect(postSignInDestination("staff", "/appointments")).toBe(
      "/appointments"
    );
  });

  it("a staff member whose next points at /my-account goes to /dashboard instead", () => {
    expect(postSignInDestination("staff", "/my-account")).toBe("/dashboard");
    expect(postSignInDestination("admin", "/my-account")).toBe("/dashboard");
    expect(postSignInDestination("staff", "/my-account?tab=orders")).toBe(
      "/dashboard"
    );
  });

  it("next values that would loop back to a sign-in page are treated as no next", () => {
    expect(postSignInDestination("customer", "/login")).toBe("/my-account");
    expect(postSignInDestination("staff", "/login")).toBe("/dashboard");
    expect(postSignInDestination("customer", "/my-account/sign-in")).toBe(
      "/my-account"
    );
    expect(postSignInDestination("staff", "/my-account/sign-in")).toBe(
      "/dashboard"
    );
    expect(
      postSignInDestination("customer", "/my-account/sign-in?next=/my-account")
    ).toBe("/my-account");
  });

  it("unsafe next values fall back to the role default (no open redirect)", () => {
    expect(postSignInDestination("customer", "https://evil.example")).toBe(
      "/my-account"
    );
    expect(postSignInDestination("staff", "https://evil.example")).toBe(
      "/dashboard"
    );
    expect(postSignInDestination("customer", "//evil.example")).toBe(
      "/my-account"
    );
  });
});

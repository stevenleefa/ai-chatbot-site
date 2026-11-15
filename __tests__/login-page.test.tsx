// The single sign-in page (/login): after sign-in it reads the
// user's profiles row and routes by role — customers to /my-account,
// staff/admin to /dashboard — honouring ?next= only when the role is
// allowed to reach it. The browser client is faked here (no live
// Supabase): signInWithPassword succeeds, getUser returns the
// signed-in user, and the profiles query returns the role under test.
import { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";
import { getBrowserClient } from "@/lib/auth/browser";

const pushMock = jest.fn();
const refreshMock = jest.fn();
let mockNext: string | null = null;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  useSearchParams: () => ({ get: (key: string) => (key === "next" ? mockNext : null) }),
}));

jest.mock("../lib/auth/browser", () => ({
  getBrowserClient: jest.fn(),
}));

type FakeClientOptions = {
  role?: string | null;
  signInError?: { message: string } | null;
};

function fakeClient({ role = "customer", signInError = null }: FakeClientOptions = {}) {
  return {
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ error: signInError }),
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest
            .fn()
            .mockResolvedValue({ data: role ? { role } : null, error: null }),
        }),
      }),
    }),
  };
}

function setClient(options: FakeClientOptions = {}) {
  (getBrowserClient as jest.Mock).mockReturnValue(fakeClient(options));
}

async function submitSignIn() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "alex@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "correct horse battery staple" },
  });
  // The sign-in is async (password check, then a profile lookup);
  // act flushes those state updates so React does not warn.
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  });
}

beforeEach(() => {
  pushMock.mockClear();
  refreshMock.mockClear();
  mockNext = null;
  setClient();
});

describe("single sign-in page (/login)", () => {
  it("is one neutral sign-in: no owner-only heading, no second sign-in link", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("heading", { name: "Sign in — Lumen Hair Studio" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Owner sign in")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Customer sign in" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create a customer account" })
    ).toHaveAttribute("href", "/my-account/sign-up");
    expect(
      screen.getByRole("link", { name: "Forgot your password?" })
    ).toHaveAttribute("href", "/auth/reset-password");
  });

  it("signing in as a customer with no next goes to /my-account", async () => {
    setClient({ role: "customer" });
    render(<LoginPage />);
    await submitSignIn();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/my-account"));
  });

  it("signing in as staff with no next goes to /dashboard", async () => {
    setClient({ role: "staff" });
    render(<LoginPage />);
    await submitSignIn();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("signing in as admin with no next goes to /dashboard", async () => {
    setClient({ role: "admin" });
    render(<LoginPage />);
    await submitSignIn();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("a customer with next pointing at an owner page is sent to /my-account, not the owner page", async () => {
    mockNext = "/dashboard";
    setClient({ role: "customer" });
    render(<LoginPage />);
    await submitSignIn();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/my-account"));
    expect(pushMock).not.toHaveBeenCalledWith("/dashboard");
  });

  it("a customer with next pointing at /settings is sent there", async () => {
    mockNext = "/settings";
    setClient({ role: "customer" });
    render(<LoginPage />);
    await submitSignIn();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/settings"));
  });

  it("a staff member with next pointing at /my-account goes to /dashboard instead", async () => {
    mockNext = "/my-account";
    setClient({ role: "staff" });
    render(<LoginPage />);
    await submitSignIn();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(pushMock).not.toHaveBeenCalledWith("/my-account");
  });

  it("a staff member with next pointing at an owner page is sent there", async () => {
    mockNext = "/leads";
    setClient({ role: "staff" });
    render(<LoginPage />);
    await submitSignIn();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/leads"));
  });

  it("wrong password shows an error and does not redirect", async () => {
    setClient({ signInError: { message: "Invalid login credentials" } });
    render(<LoginPage />);
    await submitSignIn();
    await waitFor(() =>
      expect(
        screen.getByText("Wrong email or password. Try again, or use “Forgot your password?” below.")
      ).toBeInTheDocument()
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("an unconfirmed email shows the confirmation message and does not redirect", async () => {
    setClient({ signInError: { message: "Email not confirmed" } });
    render(<LoginPage />);
    await submitSignIn();
    await waitFor(() =>
      expect(
        screen.getByText(
          "Please confirm your email first — check your inbox for the confirmation link."
        )
      ).toBeInTheDocument()
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("a missing profile row shows an error and does not redirect on a guessed role", async () => {
    setClient({ role: null });
    render(<LoginPage />);
    await submitSignIn();
    await waitFor(() =>
      expect(
        screen.getByText(
          "Your account is not set up yet — ask an admin to check your profile, then try again."
        )
      ).toBeInTheDocument()
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});

// components/PasswordStrength.tsx and the submit gate it drives on
// the sign-up and set-new-password pages. The checklist and the
// message must update live as the user types, and the submit button
// must stay disabled until every requirement passes.
//
// The pages' router and Supabase client are stubbed: the gate is
// pure UI (button disabled until the password is strong), so no
// network is exercised and the submit path is not tested here.
// The update-password page only renders its form once its session
// check resolves, so the stub returns a session.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock("../lib/auth/browser", () => ({
  getBrowserClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "user-1" } } },
      }),
      setSession: async () => ({ error: null }),
      updateUser: jest.fn(async () => ({ error: null })),
      signUp: jest.fn(),
    },
  }),
}));

import { render, screen, fireEvent } from "@testing-library/react";
import PasswordStrength, {
  PASSWORD_WEAK_MESSAGE,
  PASSWORD_STRONG_MESSAGE,
} from "@/components/PasswordStrength";
import CustomerSignUpPage from "@/app/my-account/sign-up/page";
import UpdatePasswordPage from "@/app/auth/update-password/page";

function tickedItems(): HTMLElement[] {
  return screen
    .getAllByRole("listitem")
    .filter((item) => item.textContent?.includes("✓"));
}

describe("PasswordStrength checklist", () => {
  it("shows 'Password not strong enough' and all four requirements unmet for an empty password", () => {
    render(<PasswordStrength id="pw-req" password="" />);
    const message = screen.getByText(PASSWORD_WEAK_MESSAGE);
    expect(message).toBeInTheDocument();
    expect(message).toHaveAttribute("aria-live", "polite");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(tickedItems()).toHaveLength(0);
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(
      screen.getByText("One capital letter (A–Z)")
    ).toBeInTheDocument();
    expect(screen.getByText("One number (0–9)")).toBeInTheDocument();
    expect(
      screen.getByText("One special character (e.g. !@#$%^&*)")
    ).toBeInTheDocument();
  });

  it("ticks requirements off one by one as the password improves", () => {
    const { rerender } = render(
      <PasswordStrength id="pw-req" password="abc" />
    );
    expect(tickedItems()).toHaveLength(0);

    rerender(<PasswordStrength id="pw-req" password="Abcdefg1" />);
    // Length, capital and number met — only the special character
    // is still missing.
    expect(tickedItems()).toHaveLength(3);
    expect(screen.getByText(PASSWORD_WEAK_MESSAGE)).toBeInTheDocument();

    rerender(<PasswordStrength id="pw-req" password="Abcdefg1!" />);
    expect(tickedItems()).toHaveLength(4);
    expect(screen.getByText(PASSWORD_STRONG_MESSAGE)).toBeInTheDocument();
    expect(
      screen.queryByText(PASSWORD_WEAK_MESSAGE)
    ).not.toBeInTheDocument();
  });

  it("renders under the id the parent puts in aria-describedby", () => {
    render(<PasswordStrength id="pw-req" password="abc" />);
    expect(document.getElementById("pw-req")).toBeInTheDocument();
  });
});

describe("sign-up page submit gate", () => {
  it("links the password field to the checklist", () => {
    render(<CustomerSignUpPage />);
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "aria-describedby",
      "password-requirements"
    );
    expect(
      document.getElementById("password-requirements")
    ).toBeInTheDocument();
  });

  it("keeps Create account disabled until the password is strong", () => {
    render(<CustomerSignUpPage />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    const submit = screen.getByRole("button", {
      name: "Create account",
    });
    expect(submit).toBeDisabled();

    fireEvent.change(password, { target: { value: "abc" } });
    expect(submit).toBeDisabled();
    expect(screen.getByText(PASSWORD_WEAK_MESSAGE)).toBeInTheDocument();

    // Long enough with a capital and a number, but no special.
    fireEvent.change(password, { target: { value: "Abcdefg1" } });
    expect(submit).toBeDisabled();

    fireEvent.change(password, { target: { value: "Abcdefg1!" } });
    expect(submit).toBeEnabled();
    expect(screen.getByText(PASSWORD_STRONG_MESSAGE)).toBeInTheDocument();
  });
});

describe("set-new-password page submit gate", () => {
  it("links the password field to the checklist", async () => {
    render(<UpdatePasswordPage />);
    const password = (await screen.findByLabelText(
      "New password"
    )) as HTMLInputElement;
    expect(password).toHaveAttribute(
      "aria-describedby",
      "password-requirements"
    );
    expect(
      document.getElementById("password-requirements")
    ).toBeInTheDocument();
  });

  it("keeps Update password disabled until the password is strong", async () => {
    render(<UpdatePasswordPage />);
    const password = (await screen.findByLabelText(
      "New password"
    )) as HTMLInputElement;
    const submit = screen.getByRole("button", {
      name: "Update password",
    });
    expect(submit).toBeDisabled();

    fireEvent.change(password, { target: { value: "weak" } });
    expect(submit).toBeDisabled();

    fireEvent.change(password, { target: { value: "Abcdefg1!" } });
    expect(submit).toBeEnabled();
  });
});

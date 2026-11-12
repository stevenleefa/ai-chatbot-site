// components/ReviewForm.tsx — the homepage review form's star
// picker. Only the picker is tested here: it must be a real radio
// group (fieldset + legend), five radios in DOM order 5 -> 1, and
// selecting a star must check that radio. No network: the submit
// path is not exercised, and useRouter is stubbed.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

import { render, screen, fireEvent } from "@testing-library/react";
import ReviewForm from "@/components/ReviewForm";

describe("ReviewForm star picker", () => {
  it("renders a radio group with a legend", () => {
    render(<ReviewForm />);
    expect(
      screen.getByRole("group", { name: "Your rating" })
    ).toBeInTheDocument();
  });

  it("has five radios in DOM order 5, 4, 3, 2, 1", () => {
    render(<ReviewForm />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("value"))).toEqual([
      "5",
      "4",
      "3",
      "2",
      "1",
    ]);
    expect(radios.map((r) => r.getAttribute("name"))).toEqual([
      "rating",
      "rating",
      "rating",
      "rating",
      "rating",
    ]);
  });

  it("clicking a star label checks that radio and only that radio", () => {
    render(<ReviewForm />);
    fireEvent.click(screen.getByLabelText("4 stars"));
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.find((r) => r.value === "4")!.checked).toBe(true);
    expect(radios.filter((r) => r.checked).length).toBe(1);

    fireEvent.click(screen.getByLabelText("1 star"));
    const after = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(after.find((r) => r.value === "1")!.checked).toBe(true);
    expect(after.filter((r) => r.checked).length).toBe(1);
  });

  it("requires a rating before submit", () => {
    render(<ReviewForm />);
    const radios = screen.getAllByRole("radio");
    for (const r of radios) expect(r).toBeRequired();
  });
});

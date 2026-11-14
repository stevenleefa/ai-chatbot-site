// app/locations/page.tsx and app/contact/page.tsx — the four
// locations and the "Follow us" social links. Both pages are plain
// server components (no server-only APIs), so they render in jsdom
// like any other component.
import { render, screen } from "@testing-library/react";
import LocationsPage from "@/app/locations/page";
import ContactPage from "@/app/contact/page";

describe("LocationsPage", () => {
  it("lists four locations, each with a Get directions link", () => {
    render(<LocationsPage />);
    expect(
      screen.getByText(
        "Lumen Hair Studio has four studios — come and say hello."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Lumen Hair Studio")).toBeInTheDocument();
    expect(
      screen.getByText("Lumen Hair Studio — Riverside")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Lumen Hair Studio — Old Town")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Lumen Hair Studio — Northgate")
    ).toBeInTheDocument();
    // Same hours on every branch.
    expect(
      screen.getAllByText(/Monday to Saturday, 9am to 6pm/)
    ).toHaveLength(4);
    const directions = screen.getAllByRole("link", {
      name: "Get directions",
    });
    expect(directions).toHaveLength(4);
    for (const link of directions) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("href")).toContain("google.com/maps");
    }
    // Each branch links to its own address.
    expect(directions[1].getAttribute("href")).toContain(
      "Riverside%20Walk"
    );
    expect(directions[2].getAttribute("href")).toContain(
      "Old%20Town%20Square"
    );
    expect(directions[3].getAttribute("href")).toContain(
      "Northgate%20Lane"
    );
  });
});

describe("ContactPage", () => {
  it("has a Follow us section with Instagram, Facebook and TikTok links opening in a new tab", () => {
    render(<ContactPage />);
    expect(screen.getByText("Follow us")).toBeInTheDocument();
    const instagram = screen.getByRole("link", { name: /Instagram/ });
    expect(instagram).toHaveAttribute(
      "href",
      "https://www.instagram.com/lumenhairstudio"
    );
    expect(instagram).toHaveAttribute("target", "_blank");
    expect(instagram).toHaveAttribute("rel", "noopener noreferrer");
    const facebook = screen.getByRole("link", { name: /Facebook/ });
    expect(facebook).toHaveAttribute(
      "href",
      "https://www.facebook.com/lumenhairstudio"
    );
    expect(facebook).toHaveAttribute("target", "_blank");
    expect(facebook).toHaveAttribute("rel", "noopener noreferrer");
    const tiktok = screen.getByRole("link", { name: /TikTok/ });
    expect(tiktok).toHaveAttribute(
      "href",
      "https://www.tiktok.com/@lumenhairstudio"
    );
    expect(tiktok).toHaveAttribute("target", "_blank");
    expect(tiktok).toHaveAttribute("rel", "noopener noreferrer");
  });
});

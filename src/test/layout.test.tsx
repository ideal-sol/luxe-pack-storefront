import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("shared layout", () => {
  it("renders the public header", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Luxe Pack ホーム" })).toBeInTheDocument();
  });

  it("renders the footer", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("Information")).toBeInTheDocument();
  });

  it("renders mobile navigation", () => {
    render(<MobileBottomNavigation />);
    expect(screen.getByRole("navigation", { name: "モバイルナビゲーション" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ホーム/ })).toHaveAttribute("aria-current", "page");
  });
});

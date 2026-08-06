import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation";
import { SessionProvider } from "@/components/auth/session-provider";
import { ToastProvider } from "@/components/common/toast-provider";
import type { AuthClientAdapter } from "@/lib/platform";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("shared layout", () => {
  it("renders the public header", () => {
    const client = {
      getCurrentSession: vi.fn().mockResolvedValue({ data: { authenticated: false, user: null }, metadata: { status: 200, idempotency_replayed: false } }),
    } as unknown as AuthClientAdapter;
    render(<ToastProvider><SessionProvider client={client}><SiteHeader /></SessionProvider></ToastProvider>);
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

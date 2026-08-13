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
    const view = render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("Information")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ご利用ガイド" })).toHaveAttribute("href", "/pages/guide");
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/pages/terms");
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/pages/privacy");
    expect(screen.queryByRole("link", { name: "古物営業法に基づく表示" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "特定商取引法に基づく表記" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "反社会的勢力に対する基本方針" })).not.toBeInTheDocument();

    const labels = Array.from(view.container.querySelectorAll(".site-footer__information > :not(h2)"))
      .map((item) => item.textContent);
    expect(labels).toEqual([
      "ご利用ガイド",
      "利用規約",
      "プライバシーポリシー",
      "古物営業法に基づく表示",
      "特定商取引法に基づく表記",
      "反社会的勢力に対する基本方針",
    ]);
  });

  it("renders mobile navigation", () => {
    render(<MobileBottomNavigation />);
    expect(screen.getByRole("navigation", { name: "モバイルナビゲーション" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ホーム/ })).toHaveAttribute("aria-current", "page");
  });
});

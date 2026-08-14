import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import PointsPage from "@/app/points/page";
import { SessionProvider } from "@/components/auth/session-provider";
import { ToastProvider } from "@/components/common/toast-provider";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  PointProductCardShell,
  PointPurchasePage,
} from "@/components/points/point-purchase-page";

vi.mock("next/navigation", () => ({ usePathname: () => "/points" }));

describe("point purchase page layout", () => {
  it("replaces the placeholder with the pending-contract Point layout", () => {
    render(<PointsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "ポイント購入" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "現在のポイント" })).toBeInTheDocument();
    expect(screen.getByLabelText("現在のポイント残高")).toHaveTextContent("--");
    expect(screen.getByRole("tab", { name: "すべてのユーザー" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "初回ユーザー" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("ポイント商品を準備中です。")).toBeInTheDocument();
    expect(screen.getByText("現在、ポイント商品の提供準備を進めています。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /購入/ })).not.toBeInTheDocument();
  });

  it("changes only the presentation category through pointer and keyboard input", () => {
    render(<PointPurchasePage />);
    const all = screen.getByRole("tab", { name: "すべてのユーザー" });
    const firstTime = screen.getByRole("tab", { name: "初回ユーザー" });

    fireEvent.click(firstTime);
    expect(firstTime).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("data-category", "first-time");
    expect(screen.getByText("ポイント商品を準備中です。")).toBeInTheDocument();

    fireEvent.keyDown(firstTime, { key: "ArrowLeft" });
    expect(all).toHaveAttribute("aria-selected", "true");
    expect(all).toHaveFocus();
  });

  it("supports test-only card content without defining a Platform product shape", () => {
    render(
      <PointPurchasePage
        productContent={[
          <PointProductCardShell badge="TEST BADGE" key="fixture-one">
            <h3>Test-only layout fixture</h3>
          </PointProductCardShell>,
          <PointProductCardShell
            action={<button disabled type="button">TEST CTA</button>}
            key="fixture-two"
          >
            <h3>Long test-only product name for wrapping verification</h3>
            <p>9,999,999 TEST POINTS</p>
          </PointProductCardShell>,
        ]}
      />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("Long test-only product name for wrapping verification")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "TEST CTA" })).toBeDisabled();
    expect(screen.queryByText("ポイント商品を準備中です。")).not.toBeInTheDocument();
  });

  it("keeps the shared Header, Footer, and Mobile Navigation around the route", () => {
    const view = render(
      <ToastProvider>
        <SessionProvider client={null}>
          <PublicClientProvider client={null}>
            <SiteHeader />
            <PointsPage />
            <SiteFooter />
            <MobileBottomNavigation />
          </PublicClientProvider>
        </SessionProvider>
      </ToastProvider>,
    );

    expect(view.container.querySelector(".site-header")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    const mobileNavigation = screen.getByRole("navigation", { name: "モバイルナビゲーション" });
    expect(mobileNavigation).toBeInTheDocument();
    expect(within(mobileNavigation).getByRole("link", { name: /ポイント/ })).toHaveAttribute("aria-current", "page");
  });
});

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeFirstBuy } from "@/components/points/first-buy-home";
import { FirstBuyHero } from "@/components/points/first-buy-offer";
import { FirstBuyDetailLayout, FirstBuyPointsLayout } from "@/components/points/first-buy-layout-preview";
import { firstBuyLayoutOffer, readFirstBuyLayoutState } from "@/lib/presentation/first-buy-layout";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("isolated first-buy layout", () => {
  it("requires the Preview flag and an explicit valid scalar selector", () => {
    for (const state of ["active", "expired", "unauthenticated"]) {
      expect(readFirstBuyLayoutState(state)).toBeNull();
      expect(readFirstBuyLayoutState(state, true)).toBe(state);
    }
    for (const value of [undefined, "", "unknown", ["active"], "ACTIVE"]) expect(readFirstBuyLayoutState(value, true)).toBeNull();
  });

  it("keeps the display fixed across elapsed time and creates no offer timers", () => {
    vi.useFakeTimers();
    const interval = vi.spyOn(globalThis, "setInterval");
    const timeout = vi.spyOn(globalThis, "setTimeout");
    render(<FirstBuyHero offer={firstBuyLayoutOffer("active")} />);
    expect(screen.getByRole("timer")).toHaveAccessibleName("残り 23時間41分12秒");
    vi.advanceTimersByTime(48 * 60 * 60 * 1000);
    expect(screen.getByRole("timer")).toHaveAccessibleName("残り 23時間41分12秒");
    expect(interval).not.toHaveBeenCalled(); expect(timeout).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "50円で500コインを受け取る" })).toHaveAttribute("href", "/design/first-buy/purchase/500?first_buy=active");
  });

  it("does not render a timer for unauthenticated or an offer for expired", () => {
    const { rerender } = render(<FirstBuyHero offer={firstBuyLayoutOffer("unauthenticated")} />);
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "無料で会員登録する" })).toHaveAttribute("href", "/register");
    rerender(<FirstBuyHero offer={firstBuyLayoutOffer("expired")} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("defaults active to the discount tab and preserves normal cards when switched", () => {
    render(<FirstBuyPointsLayout state="active" />);
    expect(screen.getByRole("tab", { name: "初回ユーザー（24時間限定）" })).toHaveAttribute("aria-selected", "true");
    expect(document.querySelectorAll(".fb-coin")).toHaveLength(7);
    expect(screen.getByRole("link", { name: /￥50\s*で購入/ })).toHaveAttribute("href", "/design/first-buy/purchase/500?first_buy=active");
    fireEvent.keyDown(screen.getByRole("tab", { name: "初回ユーザー（24時間限定）" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "すべてのユーザー" })).toHaveFocus();
    expect(document.querySelectorAll(".fb-coin")).toHaveLength(0);
    expect(document.querySelectorAll(".fb-strip")).toHaveLength(0);
    expect(document.querySelectorAll(".point-product-card")).toHaveLength(7);
  });

  it.each(["expired", "unauthenticated"] as const)("shows the ordinary list without a clock for %s", state => {
    render(<FirstBuyPointsLayout state={state} />);
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "すべてのユーザー" })).toHaveAttribute("aria-selected", "true");
    expect(document.querySelectorAll(".fb-coin")).toHaveLength(0);
    if (state === "unauthenticated") expect(screen.getAllByRole("link", { name: "ログインして確認" })).toHaveLength(7);
    fireEvent.click(screen.getByRole("tab", { name: "初回ユーザー" }));
    if (state === "expired") expect(within(screen.getByRole("tabpanel")).getByText("現在、このカテゴリーで表示できるコイン商品はありません。")).toBeInTheDocument();
  });

  it("opens a popup only on explicit request and restores focus after Escape", () => {
    const before = document.createElement("button"); document.body.append(before); before.focus();
    const { rerender } = render(<HomeFirstBuy offer={firstBuyLayoutOffer("active")} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<HomeFirstBuy key="popup" offer={firstBuyLayoutOffer("active")} showPopup />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "閉じる" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(within(dialog).getByRole("button", { name: "あとで見る" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(before).toHaveFocus();
    before.remove();
  });

  it.each(["close", "later", "backdrop", "cta"])("dismisses the explicit popup with %s", mode => {
    render(<HomeFirstBuy offer={firstBuyLayoutOffer("active")} showPopup />);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(mode === "backdrop" ? dialog : mode === "cta" ? within(dialog).getByRole("link") : within(dialog).getByRole("button", { name: mode === "close" ? "閉じる" : "あとで見る" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["active", "expired", "unauthenticated"] as const)("keeps the %s detail preview read-only", state => {
    render(<FirstBuyDetailLayout state={state} productId="500" />);
    expect(screen.getByRole("button", { name: "購入する（レイアウト確認のみ）" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "← コイン購入へ戻る" })).toHaveAttribute("href", `/points?first_buy=${state}`);
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("adds no offer eligibility, clock, persistence, API or payment integration", () => {
    const files = ["src/lib/presentation/first-buy-layout.ts", "src/components/points/first-buy-offer.tsx", "src/components/points/first-buy-home.tsx", "src/components/points/first-buy-layout-preview.tsx", "src/components/points/first-buy-layout-bar.tsx"];
    const forbidden = [/Date\s*\.\s*now\s*\(/, /new\s+Date\s*\(/, /setInterval\s*\(/, /setTimeout\s*\(/, new RegExp(["local", "Storage"].join("")), new RegExp(["session", "Storage"].join("")), /document\s*\.\s*cookie/, /useSession\s*\(/, /usePaymentClient\s*\(/, /usePointClient\s*\(/, /fetch\s*\(/, /@\/lib\/platform/];
    for (const file of files) for (const rule of forbidden) expect(readFileSync(file, "utf8"), `${file}: ${rule}`).not.toMatch(rule);
  });
});

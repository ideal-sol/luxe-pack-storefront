import { render, screen } from "@testing-library/react";
import BeginnersPage from "@/app/beginners/page";
import { beginnersGuideContent } from "@/components/catalog/beginners-guide";
import { beginnersRoute, publicRoutes } from "@/lib/routes/navigation";

describe("はじめての方へ", () => {
  it("renders the design sections with links to the terms, the trade law notice, contact and the catalog", () => {
    render(<BeginnersPage />);
    expect(screen.getByRole("heading", { level: 1, name: "はじめての方へ" })).toBeInTheDocument();
    for (const name of ["オリポケは、ポケモンカード専門のオンラインオリパです", "コインについて", "引く前に、中身を全部お見せします", "当たったカードの受け取り方", "ご利用の条件", "お困りのときは"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getAllByText(/^STEP \d/)).toHaveLength(4);
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/pages/terms");
    expect(screen.getByRole("link", { name: "特定商取引法に基づく表示" })).toHaveAttribute("href", "/pages/tradelaw");
    expect(screen.getByRole("link", { name: "お問い合わせフォーム" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "ガチャ一覧を見る" })).toHaveAttribute("href", "/gachas");
  });

  it("uses Coin terminology, mentions SMS verification and omits linked login", () => {
    const text = JSON.stringify(beginnersGuideContent);
    expect(text).not.toMatch(/ポイント|\dpt\b/);
    expect(text).toContain("SMS認証");
    expect(text).not.toMatch(/Google|LINE/);
  });

  it("is registered as a public route", () => {
    expect(beginnersRoute).toBe("/beginners");
    expect(publicRoutes).toContain("/beginners");
  });
});

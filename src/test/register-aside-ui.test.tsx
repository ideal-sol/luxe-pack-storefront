import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RegisterAside } from "@/components/auth/register-aside";
import { brandAssetUrl } from "@/lib/brand-assets";
import { readFileSync } from "node:fs";

describe("会員登録の右ペイン", () => {
  it("ご登録でもらえるものと、18歳以上の方に限る旨を表示する", () => {
    render(<RegisterAside />);
    const benefit = screen.getByRole("region", { name: "ご登録でもらえるもの" });
    expect(within(benefit).getByText("新規登録限定ガチャ")).toBeInTheDocument();
    expect(within(benefit).getByText("1回無料")).toBeInTheDocument();
    expect(within(benefit).getByText("ログインボーナスガチャ")).toBeInTheDocument();
    expect(within(benefit).getByText("毎日1回無料")).toBeInTheDocument();
    expect(benefit).toHaveTextContent("ご登録は無料です。コインを購入しない限り費用はかかりません。");
    expect(benefit.querySelector("img")).toHaveAttribute("src", brandAssetUrl("sd_orika_egao.webp"));
    expect(benefit.querySelector("img")).toHaveAttribute("alt", "");
    expect(benefit.querySelector("img")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("complementary", { name: "ご登録について" })).toBeInTheDocument();
    const age = screen.getByRole("region", { name: "ご利用は18歳以上の方に限ります" });
    expect(age).toHaveTextContent("18歳未満の方はご登録いただけません。18歳以上20歳未満の方は、保護者の方の同意が必要です。");
  });

  it("places the aside after the existing form and switches to two columns at 900px", () => {
    const page = readFileSync("src/app/register/page.tsx", "utf8");
    expect(page.indexOf("<RegisterAside />")).toBeGreaterThan(page.indexOf("<RegisterForm />"));
    const css = readFileSync("src/styles/theme-oripoke.css", "utf8");
    expect(css).toMatch(/\.register-layout \{[^}]*display: grid;[^}]*max-width: 560px/);
    expect(css).toMatch(/@media \(min-width: 900px\)\s*\{\s*\.register-layout \{[^}]*grid-template-columns: minmax\(0, 1\.3fr\) minmax\(0, 1fr\)/);
    expect(readFileSync("src/app/pre-register/page.tsx", "utf8")).not.toContain("RegisterAside");
  });
});

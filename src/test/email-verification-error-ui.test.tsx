import { render, screen } from "@testing-library/react";
import VerifyEmailErrorPage from "@/app/verify-email/error/page";

const genericMessage =
  "メール認証を完了できませんでした。認証リンクが無効または期限切れの可能性があります。";
const claimedMessage =
  "このメールアドレスはすでに認証済みです。ログインしてご利用ください。";

async function renderPage(searchParams: Record<string, string | readonly string[] | undefined> = {}) {
  render(await VerifyEmailErrorPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("SITE-035 public Email Verification Error Page", () => {
  it("renders publicly without a Session provider and links to Login and Home", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "メール認証に失敗しました" })).toBeInTheDocument();
    expect(screen.getByText(genericMessage)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログインする" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "トップへ戻る" })).toHaveAttribute("href", "/");
  });

  it("presents the canonical EMAIL_ALREADY_CLAIMED code", async () => {
    await renderPage({ code: "EMAIL_ALREADY_CLAIMED" });

    expect(screen.getByText(claimedMessage)).toBeInTheDocument();
    expect(screen.queryByText(genericMessage)).not.toBeInTheDocument();
  });

  it("falls back to the generic presentation for an unknown code", async () => {
    await renderPage({ code: "UNRECOGNIZED_PLATFORM_CODE" });

    expect(screen.getByText(genericMessage)).toBeInTheDocument();
    expect(screen.queryByText("UNRECOGNIZED_PLATFORM_CODE")).not.toBeInTheDocument();
  });

  it("falls back to the generic presentation when code is missing or repeated", async () => {
    const missing = await VerifyEmailErrorPage({ searchParams: Promise.resolve({}) });
    const missingView = render(missing);
    expect(screen.getByText(genericMessage)).toBeInTheDocument();
    missingView.unmount();

    await renderPage({ code: ["EMAIL_ALREADY_CLAIMED", "UNEXPECTED"] });
    expect(screen.getByText(genericMessage)).toBeInTheDocument();
  });

  it("never renders raw Problem Details or other query text", async () => {
    const rawValues = {
      code: "UNKNOWN_CODE_SHOULD_NOT_RENDER",
      detail: "raw-detail-should-not-render",
      stack: "raw-stack-should-not-render",
      title: "raw-title-should-not-render",
      type: "https://platform.test/problems/raw-type-should-not-render",
    };

    await renderPage(rawValues);

    expect(screen.getByText(genericMessage)).toBeInTheDocument();
    for (const value of Object.values(rawValues)) {
      expect(screen.queryByText(value)).not.toBeInTheDocument();
    }
  });
});

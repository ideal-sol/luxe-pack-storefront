import { render, screen, waitFor } from "@testing-library/react";
import { PUBLIC_FOOTER_PAGES_FIXTURE } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation";
import { SessionProvider } from "@/components/auth/session-provider";
import { ToastProvider } from "@/components/common/toast-provider";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import type { AuthClientAdapter } from "@/lib/platform";
import type { PublicCatalogAdapter } from "@/lib/platform";
import { PointClientProvider } from "@/components/points/point-client-provider";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("shared layout", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_NAME", "OripaZ"));
  afterEach(() => vi.unstubAllEnvs());

  it.each(["OripaZ", "Test Store", "オリポケ"])("renders the public header with app name %s", async (appName) => {
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", appName);
    const client = {
      getCurrentSession: vi.fn().mockResolvedValue({ data: { authenticated: false, user: null }, metadata: { status: 200, idempotency_replayed: false } }),
    } as unknown as AuthClientAdapter;
    const view = render(<ToastProvider><SessionProvider client={client}><PointClientProvider client={null}><SiteHeader /></PointClientProvider></SessionProvider></ToastProvider>);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "パック" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "コイン" })).toHaveAttribute("href", "/points");
    expect(screen.getByRole("link", { name: "お知らせ" })).toHaveAttribute("href", "/notices");
    expect(screen.getByRole("link", { name: `${appName} ホーム` })).toBeInTheDocument();
    expect(screen.getByText(appName)).toBeInTheDocument();
    expect(view.container.querySelector(".wordmark__seal")).toHaveTextContent("OZ");
    expect(view.container).not.toHaveTextContent("LUXE PACK");
    expect((await screen.findAllByRole("link", { name: "新規登録" })).length).toBeGreaterThan(0);
  });

  it.each(["OripaZ", "Test Store", "オリポケ"])("renders Backend-ordered Footer pages with app name %s", async (appName) => {
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", appName);
    const secondPage = {
      id: "0198a001-0000-7000-8000-000000000304",
      slug: "privacy",
      title: "プライバシーポリシー",
    } as const;
    const client = {
      listFooterPages: vi.fn().mockResolvedValue({
        data: { items: [PUBLIC_FOOTER_PAGES_FIXTURE.response.items[0], secondPage] },
        metadata: { status: 200, idempotency_replayed: false },
      }),
    } as unknown as PublicCatalogAdapter;
    const view = render(<PublicClientProvider client={client}><SiteFooter /></PublicClientProvider>);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "パック" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "コイン" })).toHaveAttribute("href", "/points");
    expect(screen.getByRole("link", { name: "お知らせ" })).toHaveAttribute("href", "/notices");
    expect(screen.getByText(appName)).toBeInTheDocument();
    expect(view.container.querySelector(".wordmark__seal")).toHaveTextContent("OZ");
    expect(view.container).toHaveTextContent(`© ${appName}`);
    expect(view.container).not.toHaveTextContent("LUXE PACK");
    expect(screen.getByText("Information")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/pages/terms");
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/pages/privacy");
    expect(screen.queryByText(PUBLIC_FOOTER_PAGES_FIXTURE.excluded.footer_off.title)).not.toBeInTheDocument();
    expect(screen.queryByText(PUBLIC_FOOTER_PAGES_FIXTURE.excluded.outside_publication_period.title)).not.toBeInTheDocument();

    const labels = Array.from(view.container.querySelectorAll(".site-footer__information a"))
      .map((item) => item.textContent);
    expect(labels).toEqual(["利用規約", "プライバシーポリシー"]);
  });

  it("keeps the Footer intact for an empty canonical collection", async () => {
    const client = {
      listFooterPages: vi.fn().mockResolvedValue({
        data: { items: [] },
        metadata: { status: 200, idempotency_replayed: false },
      }),
    } as unknown as PublicCatalogAdapter;
    render(<PublicClientProvider client={client}><SiteFooter /></PublicClientProvider>);
    await waitFor(() => expect(client.listFooterPages).toHaveBeenCalledOnce());
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Information")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "利用規約" })).not.toBeInTheDocument();
  });

  it("contains Footer navigation failures without breaking other regions", async () => {
    const client = {
      listFooterPages: vi.fn().mockRejectedValue(new Error("fixture transport failure")),
    } as unknown as PublicCatalogAdapter;
    render(<PublicClientProvider client={client}><SiteFooter /></PublicClientProvider>);
    await waitFor(() => expect(client.listFooterPages).toHaveBeenCalledOnce());
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("OripaZ")).toBeInTheDocument();
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders mobile navigation", () => {
    render(<MobileBottomNavigation />);
    expect(screen.getByRole("link", { name: "パック" })).toHaveAttribute("href", "/gachas");
    expect(screen.getByRole("navigation", { name: "モバイルナビゲーション" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ホーム/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /コイン/ })).toHaveAttribute("href", "/points");
  });
});

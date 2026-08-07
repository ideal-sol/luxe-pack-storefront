import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import { PUBLIC_CONTENT_FIXTURE } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import { NoticeDetail } from "@/components/content/notice-detail";
import { NoticeList } from "@/components/content/notice-list";
import { SafeContent } from "@/components/content/safe-content";
import { StaticPage } from "@/components/content/static-page";
import type { ContentNotice, ContentStaticPage, PublicCatalogAdapter } from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;
const notice = PUBLIC_CONTENT_FIXTURE.notice as ContentNotice;
const staticPage: ContentStaticPage = {
  body_html: "<h2>ご利用について</h2><p>Canonical static content.</p><ul><li>First section</li><li>Second section</li></ul>",
  checksum_sha256: "7a9cfb28bf7ec29156a06182de4097920877db4279b231306f975c2e6c0f6200",
  id: "0198a001-0000-7000-8000-000000000204",
  is_legal: true,
  publish_end_at: null,
  publish_start_at: "2026-07-28T00:00:00Z",
  slug: "fixture-page",
  title: "Fixture Page",
};

function response<T>(data: T) {
  return { data, metadata };
}

function publicClient(overrides: Partial<PublicCatalogAdapter> = {}): PublicCatalogAdapter {
  return {
    getNotice: vi.fn().mockResolvedValue(response(notice)),
    getStaticPage: vi.fn().mockResolvedValue(response(staticPage)),
    listBanners: vi.fn().mockResolvedValue(response({ items: [] })),
    listGachaCategories: vi.fn().mockResolvedValue(response({ data: [] })),
    listGachaTags: vi.fn().mockResolvedValue(response({ data: [] })),
    listGachas: vi.fn().mockResolvedValue(response({ data: [], meta: { has_more: false, next_cursor: null, page_size: 0 } })),
    listNotices: vi.fn().mockResolvedValue(response({ items: [notice], next_cursor: null })),
    ...overrides,
  } as PublicCatalogAdapter;
}

function renderPublic(ui: React.ReactNode, client: PublicCatalogAdapter | null) {
  return render(<PublicClientProvider client={client}>{ui}</PublicClientProvider>);
}

function problem(status: number) {
  return new ApiProblemError({
    code: "CONTENT_REQUEST_FAILED",
    request_id: `request-content-${status}`,
    retryable: status >= 500,
    status,
    title: "Content request failed",
    type: "https://storefront.test/problems/content-request-failed",
  });
}

describe("public notice list", () => {
  it("renders multiple notices, important state, and detail links", async () => {
    const important = { ...notice, id: "0198a001-0000-7000-8000-000000000205", is_important: true, title: "Important Fixture" };
    renderPublic(<NoticeList />, publicClient({
      listNotices: vi.fn().mockResolvedValue(response({ items: [notice, important], next_cursor: null })),
    }));
    expect(await screen.findByRole("link", { name: `${notice.title}を読む` })).toHaveAttribute("href", `/notices/${notice.id}`);
    expect(screen.getByRole("link", { name: `${important.title}を読む` })).toHaveAttribute("href", `/notices/${important.id}`);
    expect(screen.getByText("重要")).toBeInTheDocument();
    expect(screen.getAllByText(/2026/)).toHaveLength(2);
  });

  it("distinguishes loading, empty, typed error, and configuration unavailable", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderPublic(<NoticeList />, publicClient({ listNotices: vi.fn(() => pending) }));
    expect(screen.getByRole("status")).toHaveTextContent("お知らせを読み込み中");
    loading.unmount();

    const empty = renderPublic(<NoticeList />, publicClient({
      listNotices: vi.fn().mockResolvedValue(response({ items: [], next_cursor: null })),
    }));
    await screen.findByText("お知らせはありません");
    empty.unmount();

    const error = renderPublic(<NoticeList />, publicClient({ listNotices: vi.fn().mockRejectedValue(problem(503)) }));
    await screen.findByText("お知らせを取得できませんでした");
    error.unmount();

    renderPublic(<NoticeList />, null);
    expect(screen.getByText("お知らせを表示できません")).toBeInTheDocument();
  });

  it("continues with the canonical cursor", async () => {
    const second = { ...notice, id: "0198a001-0000-7000-8000-000000000206", title: "Second Fixture" };
    const listNotices = vi.fn()
      .mockResolvedValueOnce(response({ items: [notice], next_cursor: "notice-cursor-002" }))
      .mockResolvedValueOnce(response({ items: [second], next_cursor: null }));
    renderPublic(<NoticeList />, publicClient({ listNotices }));
    fireEvent.click(await screen.findByRole("button", { name: "さらに表示" }));
    await screen.findByText(second.title);
    expect(listNotices).toHaveBeenLastCalledWith({ cursor: "notice-cursor-002", limit: 10 });
  });
});

describe("public notice detail", () => {
  it("renders canonical title, date, body, back link, and safe external link", async () => {
    const linked = { ...notice, body_html: '<p>Public-safe body.</p><a href="https://example.com/path">External reference</a>' };
    renderPublic(<NoticeDetail noticeId={notice.id} />, publicClient({ getNotice: vi.fn().mockResolvedValue(response(linked)) }));
    expect(await screen.findByRole("heading", { name: notice.title })).toBeInTheDocument();
    expect(screen.getByText("Public-safe body.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /お知らせ一覧へ/ })).toHaveAttribute("href", "/notices");
    expect(screen.getByRole("link", { name: "External reference" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "External reference" })).toHaveAttribute("target", "_blank");
  });

  it("distinguishes loading, not found, error, and configuration unavailable", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderPublic(<NoticeDetail noticeId={notice.id} />, publicClient({ getNotice: vi.fn(() => pending) }));
    expect(screen.getByRole("status")).toHaveTextContent("お知らせ本文を読み込み中");
    loading.unmount();

    const missing = renderPublic(<NoticeDetail noticeId={notice.id} />, publicClient({ getNotice: vi.fn().mockRejectedValue(problem(404)) }));
    await screen.findByText("お知らせが見つかりません");
    missing.unmount();

    const error = renderPublic(<NoticeDetail noticeId={notice.id} />, publicClient({ getNotice: vi.fn().mockRejectedValue(problem(503)) }));
    await screen.findByText("お知らせを取得できませんでした");
    error.unmount();

    renderPublic(<NoticeDetail noticeId={notice.id} />, null);
    expect(screen.getByText("お知らせを表示できません")).toBeInTheDocument();
  });
});

describe("public static page", () => {
  it("renders canonical long-form content and switches slug requests", async () => {
    const getStaticPage = vi.fn().mockResolvedValue(response(staticPage));
    const view = renderPublic(<StaticPage slug="terms" />, publicClient({ getStaticPage }));
    expect(await screen.findByRole("heading", { name: staticPage.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ご利用について" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    view.rerender(<PublicClientProvider client={publicClient({ getStaticPage })}><StaticPage slug="privacy" /></PublicClientProvider>);
    await waitFor(() => expect(getStaticPage).toHaveBeenLastCalledWith("privacy"));
  });

  it("distinguishes loading, not found, typed error, and configuration unavailable", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderPublic(<StaticPage slug="terms" />, publicClient({ getStaticPage: vi.fn(() => pending) }));
    expect(screen.getByRole("status")).toHaveTextContent("ページを読み込み中");
    loading.unmount();

    const missing = renderPublic(<StaticPage slug="missing" />, publicClient({ getStaticPage: vi.fn().mockRejectedValue(problem(404)) }));
    await screen.findByText("ページが見つかりません");
    missing.unmount();

    const error = renderPublic(<StaticPage slug="terms" />, publicClient({ getStaticPage: vi.fn().mockRejectedValue(problem(503)) }));
    await screen.findByText("ページを取得できませんでした");
    error.unmount();

    renderPublic(<StaticPage slug="terms" />, null);
    expect(screen.getByText("ページを表示できません")).toBeInTheDocument();
  });
});

describe("safe canonical content", () => {
  it("removes scripts, event handlers, unsafe links, and preserves safe structure", () => {
    const { container } = render(<SafeContent html={'<h1>Heading</h1><p onclick="alert(1)">Body</p><script>alert(1)</script><a href="javascript:alert(1)">Unsafe</a><a href="/notices">Safe</a>'} />);
    expect(screen.getByRole("heading", { name: "Heading", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Body")).not.toHaveAttribute("onclick");
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "Safe" })).toHaveAttribute("href", "/notices");
  });
});

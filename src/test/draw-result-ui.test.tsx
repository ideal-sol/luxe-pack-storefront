import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_DRAW_FIXTURE,
  PUBLIC_PARTIAL_REMAINING_DRAW_FIXTURE,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import { DrawResultView } from "@/components/draw/draw-result";
import { createDrawClientTestHarness } from "@/lib/platform/testing";
import type { AuthClientAdapter, DrawClientAdapter, DrawResponse } from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;
// Existing summary checks use a no-presentation, compact legacy response.
const result = { ...PUBLIC_DRAW_FIXTURE, presentation: null, high_rank_results: [] } as DrawResponse;
delete result.results;
const snapshotImagePath = "/api" + "/v2/catalog/presentation-assets/0198a001-0000-7000-8000-000000000302/content";
const snapshotVideoPath = "/api" + "/v2/catalog/presentation-assets/0198a001-0000-7000-8000-000000000303/content";
const drawSnapshot = {
  id: "0198a001-0000-7000-8000-000000000301",
  sequence_number: 1,
  result_type: "prize",
  rank: {
    id: "0198a001-0000-7000-8000-000000000003",
    name: "現在のSS賞",
  },
  rank_name_snapshot: "当時の1等",
  result_image_snapshot: {
    id: "0198a001-0000-7000-8000-000000000302",
    path: snapshotImagePath,
    checksum_sha256: "2".repeat(64),
    media_type: "image",
    mime_type: "image/png",
    alt_text: "当時の1等結果画像",
  },
  rank_lineup_image: {
    id: "lineup", path: "/fixtures/rank.png", checksum_sha256: "4".repeat(64), media_type: "image", mime_type: "image/png", alt_text: "ランク見出し画像",
  },
  video_snapshot: {
    id: "0198a001-0000-7000-8000-000000000303",
    path: snapshotVideoPath,
    checksum_sha256: "3".repeat(64),
    media_type: "video",
    mime_type: "video/mp4",
    alt_text: "当時のgold-v1演出",
  },
  prize: { ...result.prize_counts[0]!.prize, presentation_asset: { id: "prize", path: "/fixtures/prize-a.png", checksum_sha256: "5".repeat(64), media_type: "image", mime_type: "image/png", alt_text: "景品Aサムネイル" } },
  point_back: null,
} satisfies DrawResponse["high_rank_results"][number];
const snapshotResult = {
  ...result,
  requested_count: 1,
  executed_count: 1,
  high_rank_results: [drawSnapshot],
  high_rank_results_truncated: false,
  results: [drawSnapshot],
} satisfies DrawResponse;

function response<T>(data: T) {
  return { data, metadata };
}

function authClient(authenticated = true): AuthClientAdapter {
  const session = authenticated
    ? PUBLIC_AUTH_FIXTURE.authenticated_session
    : PUBLIC_AUTH_FIXTURE.anonymous_session;
  return {
    changeUserPassword: vi.fn(),
    completeEmailChange: vi.fn(),
    completeEmailVerification: vi.fn(),
    confirmPasswordReset: vi.fn(),
    createEmailChangeRequest: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(response(session)),
    getSmsVerificationStatus: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    reauthenticateUserPassword: vi.fn(),
    requestPasswordReset: vi.fn(),
    resendEmailVerification: vi.fn(),
    resendSmsVerification: vi.fn(),
    sendSmsVerification: vi.fn(),
    verifySmsCode: vi.fn(),
  } as AuthClientAdapter;
}

function drawClient(overrides: Partial<DrawClientAdapter> = {}): DrawClientAdapter {
  return {
    createDraw: vi.fn(),
    getDrawRequest: vi.fn().mockResolvedValue(response(result)),
    listDrawHistory: vi.fn(),
    ...overrides,
  } as DrawClientAdapter;
}

function renderResult(
  client: DrawClientAdapter | null = drawClient(),
  authenticated = true,
  id = result.id,
) {
  return render(
    <SessionProvider client={authClient(authenticated)}>
      <DrawClientProvider client={client}>
        <DrawResultView drawRequestId={id} />
      </DrawClientProvider>
    </SessionProvider>,
  );
}

describe("Draw Result recovery UI", () => {
  it("loads the canonical result by public ID and renders its fields", async () => {
    const getDrawRequest = vi.fn().mockResolvedValue(response(result));
    const createDraw = vi.fn();
    renderResult(drawClient({ createDraw, getDrawRequest }));
    expect(await screen.findByRole("heading", { level: 1, name: "抽選結果" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "トップに戻る" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "ガチャ一覧へ" })).not.toBeInTheDocument();
    expect(screen.getByText(`${result.executed_count.toLocaleString()}回`)).toBeInTheDocument();
    expect(screen.getByText(`${result.point_cost_total.toLocaleString()} コイン`)).toBeInTheDocument();
    expect(screen.getByText(result.prize_counts[0]!.prize.name)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: result.prize_counts[0]!.prize.presentation_asset!.alt_text! })).toBeInTheDocument();
    expect(getDrawRequest).toHaveBeenCalledWith(result.id);
    expect(createDraw).not.toHaveBeenCalled();
  });

  it("reloads through GET without resending the Draw mutation", async () => {
    const getDrawRequest = vi.fn().mockResolvedValue(response(result));
    const createDraw = vi.fn();
    const client = drawClient({ createDraw, getDrawRequest });
    const first = renderResult(client);
    await screen.findByRole("heading", { level: 1, name: "抽選結果" });
    first.unmount();
    renderResult(client);
    await screen.findByRole("heading", { level: 1, name: "抽選結果" });
    expect(getDrawRequest).toHaveBeenCalledTimes(2);
    expect(createDraw).not.toHaveBeenCalled();
  });

  it("renders the prize thumbnail and rank lineup image without a card video", async () => {
    const getDrawRequest = vi.fn().mockResolvedValue(response(snapshotResult));
    renderResult(drawClient({ getDrawRequest }));

    expect(await screen.findByRole("img", { name: drawSnapshot.rank_lineup_image.alt_text })).toHaveAttribute("src", expect.stringContaining(drawSnapshot.rank_lineup_image.path));
    expect(screen.queryByText(drawSnapshot.rank.name)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: drawSnapshot.prize.presentation_asset.alt_text }).getAttribute("src")
      ?.endsWith(drawSnapshot.prize.presentation_asset.path)).toBe(true);
    expect(document.querySelectorAll("video, source")).toHaveLength(0);
    expect(getDrawRequest).toHaveBeenCalledTimes(1);
    expect(getDrawRequest).toHaveBeenCalledWith(result.id);
  });

  it("keeps distinct thumbnails for two prizes of the same rank in result order with no stock badge", async () => {
    const second = { ...drawSnapshot, id: "result-b", sequence_number: 2, prize: { ...drawSnapshot.prize, id: "prize-b", name: "景品B", presentation_asset: { ...drawSnapshot.prize.presentation_asset, path: "/fixtures/prize-b.png", alt_text: "景品Bサムネイル" } } };
    const multiple = { ...snapshotResult, results: [drawSnapshot, second] } satisfies DrawResponse;
    renderResult(drawClient({ getDrawRequest: vi.fn().mockResolvedValue(response(multiple)) }));
    await screen.findByRole("heading", { level: 1, name: "抽選結果" });
    const cards = [...document.querySelectorAll<HTMLElement>(".draw-snapshot-card")];
    expect(cards).toHaveLength(2);
    [drawSnapshot, second].forEach((item, index) => {
      const card = cards[index]!;
      expect(card.querySelector(".draw-snapshot-card__image img")).toHaveAttribute("src", expect.stringContaining(item.prize.presentation_asset.path));
      expect(within(card).getByRole("img", { name: item.rank_lineup_image.alt_text })).toHaveAttribute("src", expect.stringContaining(item.rank_lineup_image.path));
      expect(within(card).getByText(`抽選順 ${index + 1}`)).toBeInTheDocument();
    });
    expect(screen.getByText(`× ${result.prize_counts[0]!.count.toLocaleString("ja-JP")}`)).toBeInTheDocument();
    expect(document.querySelector(".prize-rank__stock")).toBeNull();
    expect(screen.queryByText(/^\d+点$/)).not.toBeInTheDocument();
  });

  it("falls back to prize placeholder and rank name when their images are absent", async () => {
    const noImages = { ...drawSnapshot, rank_lineup_image: null, prize: { ...drawSnapshot.prize, presentation_asset: null } };
    renderResult(drawClient({ getDrawRequest: vi.fn().mockResolvedValue(response({ ...snapshotResult, results: [noImages] })) }));
    expect(await screen.findByText(drawSnapshot.rank.name)).toBeInTheDocument();
    const card = document.querySelector<HTMLElement>(".draw-snapshot-card")!;
    expect(within(card).getByText("PRIZE IMAGE")).toBeInTheDocument();
    expect(card.querySelector("img")).toBeNull();
  });

  it("distinguishes the selected count from the canonical partial executed count", async () => {
    const partial = { ...PUBLIC_PARTIAL_REMAINING_DRAW_FIXTURE.response, presentation: null, high_rank_results: [] } as DrawResponse;
    delete partial.results;
    const getDrawRequest = vi.fn().mockResolvedValue(response(partial));
    const createDraw = vi.fn();
    render(
      <SessionProvider client={authClient()}>
        <DrawClientProvider client={drawClient({ createDraw, getDrawRequest })}>
          <DrawResultView drawRequestId={partial.id} />
        </DrawClientProvider>
      </SessionProvider>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "抽選結果" })).toBeInTheDocument();
    expect(screen.getByText("選択回数").nextElementSibling).toHaveTextContent("1,000回");
    expect(screen.getByText("実行回数").nextElementSibling).toHaveTextContent("900回");
    expect(screen.getByText("900回の抽選が完了しました")).toBeInTheDocument();
    expect(getDrawRequest).toHaveBeenCalledWith(partial.id);
    expect(createDraw).not.toHaveBeenCalled();
  });

  it("renders multiple canonical Prize aggregates and image fallback", async () => {
    const second = {
      ...result.prize_counts[0]!,
      prize: { ...result.prize_counts[0]!.prize, presentation_asset: null, id: "0198a001-0000-7000-8000-000000000010", name: "Fixture A景品" },
      rank: { id: "0198a001-0000-7000-8000-000000000004", name: "Aランク" },
    };
    const multiple = { ...result, prize_counts: [result.prize_counts[0]!, second] } satisfies DrawResponse;
    renderResult(drawClient({ getDrawRequest: vi.fn().mockResolvedValue(response(multiple)) }));
    expect(await screen.findByText("Fixture A景品")).toBeInTheDocument();
    expect(screen.getByText(result.prize_counts[0]!.prize.name)).toBeInTheDocument();
    expect(screen.getAllByText("PRIZE IMAGE")).toHaveLength(1);
  });

  it("distinguishes login, missing configuration, not found, and error states", async () => {
    const login = renderResult(drawClient(), false);
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
    login.unmount();

    const configuration = renderResult(null);
    expect(await screen.findByText("抽選結果を表示できません")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "トップに戻る" })).toHaveAttribute("href", "/");
    expect(screen.getByText("エラーが発生しました、運営までお問い合わせください")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Platform接続/);
    configuration.unmount();

    const notFoundProblem = new ApiProblemError({
      code: "DRAW_REQUEST_NOT_FOUND",
      request_id: "request-result-not-found",
      retryable: false,
      status: 404,
      title: "Not found",
      type: "https://storefront.test/problems/not-found",
    });
    const notFound = renderResult(drawClient({ getDrawRequest: vi.fn().mockRejectedValue(notFoundProblem) }));
    expect(await screen.findByText("抽選結果が見つかりません")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "トップに戻る" })).toHaveAttribute("href", "/");
    notFound.unmount();

    const errorProblem = new ApiProblemError({
      code: "DRAW_RESULT_UNAVAILABLE",
      request_id: "request-result-error",
      retryable: true,
      status: 503,
      title: "backend title",
      type: "https://storefront.test/problems/unavailable",
    });
    renderResult(drawClient({ getDrawRequest: vi.fn().mockRejectedValue(errorProblem) }));
    expect(await screen.findByText("抽選結果を取得できませんでした")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "トップに戻る" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "ガチャ一覧へ" })).not.toBeInTheDocument();
    expect(screen.queryByText("backend title")).not.toBeInTheDocument();
  });

  it("never calls the Draw mutation on mount or browser-style remount", async () => {
    const createDraw = vi.fn();
    const client = drawClient({ createDraw });
    const view = renderResult(client);
    await waitFor(() => expect(screen.getByRole("heading", { name: "抽選結果" })).toBeInTheDocument());
    view.unmount();
    expect(createDraw).not.toHaveBeenCalled();
  });

  it("uses the approved empty-Prize copy without Platform wording", async () => {
    renderResult(drawClient({
      getDrawRequest: vi.fn().mockResolvedValue(response({ ...result, prize_counts: [] })),
    }));
    expect(await screen.findByText("獲得景品はありません、コイン還元をご確認ください")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Platform");
  });
});

const representative = {
  rank: { id: "canonical-rank", name: "代表ランク" },
  video_snapshot: { ...drawSnapshot.video_snapshot, id: "representative", path: "/fixtures/representative.mp4", alt_text: "代表演出動画" },
} satisfies NonNullable<DrawResponse["presentation"]>;

function fullResult(count: 1 | 10 | 100 | 1000): DrawResponse {
  const results = Array.from({ length: count }, (_, index) => ({
    ...drawSnapshot,
    id: `result-${index}`,
    // Deliberately adversarial Rank, sequence and name order: API array is authority.
    sequence_number: count - index,
    rank: { id: `rank-${count - index}`, name: `ランク${count - index}` },
    rank_lineup_image: null,
    prize: { ...drawSnapshot.prize, id: `prize-${index}`, name: `景品${count - index}` },
  }));
  return {
    ...snapshotResult, requested_count: count, executed_count: count,
    results, high_rank_results: results.slice(0, 20).reverse(),
    high_rank_results_truncated: count > 20,
    presentation: representative,
  };
}

function expectFullResults(data: DrawResponse) {
  const cards = [...document.querySelectorAll<HTMLElement>(".draw-snapshot-card")];
  expect(cards).toHaveLength(data.results!.length);
  expect(cards.map((card) => card.querySelector("h3")?.textContent)).toEqual(data.results!.map((item) => item.prize!.name));
  expect(new Set(cards.map((card) => card.querySelector("h3")?.textContent)).size).toBe(data.results!.length);
  expect(cards.map((card) => card.querySelector(".draw-snapshot-card__copy > p")?.textContent))
    .toEqual(data.results!.map((item) => `抽選順 ${item.sequence_number.toLocaleString("ja-JP")}`));
  expect(document.querySelectorAll("video, source")).toHaveLength(0);
}

function RefreshSession() {
  const { refreshSession } = useSession();
  return <button onClick={() => void refreshSession()} type="button">Refresh session</button>;
}

describe("canonical Draw presentation and full results", () => {
  it("keeps loading until the canonical GET completes, without revealing media or results", async () => {
    let resolve!: (value: ReturnType<typeof response<DrawResponse>>) => void;
    const getDrawRequest = vi.fn().mockReturnValue(new Promise((done) => { resolve = done; }));
    renderResult(drawClient({ getDrawRequest }));
    await waitFor(() => expect(getDrawRequest).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
    expect(document.querySelectorAll("video, .draw-snapshot-card, .draw-result")).toHaveLength(0);
    await act(async () => resolve(response(fullResult(10))));
    expect(screen.getByLabelText("代表演出動画")).toBeInTheDocument();
    expect(document.querySelectorAll(".draw-snapshot-card, .draw-result")).toHaveLength(0);
  });

  it.each(["ended", "skip", "error"] as const)("shows only the representative until %s, then all results without fallback", async (event) => {
    const data = fullResult(10);
    const client = drawClient({ getDrawRequest: vi.fn().mockResolvedValue(response(data)) });
    renderResult(client);
    const video = await screen.findByLabelText("代表演出動画");
    expect(video).toHaveAttribute("src", representative.video_snapshot.path);
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("controls");
    expect(document.querySelectorAll("video")).toHaveLength(1);
    expect(document.querySelectorAll(".draw-snapshot-card, .draw-result")).toHaveLength(0);
    if (event === "skip") fireEvent.click(screen.getByRole("button", { name: "スキップ" }));
    else fireEvent[event](video);
    expectFullResults(data);
    expect(screen.getByRole("link", { name: "獲得アイテムを確認" })).toHaveAttribute("href", "/mypage/prizes");
    expect(client.createDraw).not.toHaveBeenCalled();
    expect(client.getDrawRequest).toHaveBeenCalledTimes(1);
  });

  it.each(["null", "absent", "image", "external", "protocol-relative"])("goes directly to results for %s presentation without inferring from card videos", async (kind) => {
    const data = fullResult(10);
    if (kind === "absent") delete data.presentation;
    else if (kind === "null") data.presentation = null;
    else data.presentation = { ...representative, video_snapshot: { ...representative.video_snapshot,
      ...(kind === "image" ? { media_type: "image" as const } : { path: kind === "external" ? "https://example.invalid/video.mp4" : "//example.invalid/video.mp4" }),
    } };
    renderResult(drawClient({ getDrawRequest: vi.fn().mockResolvedValue(response(data)) }));
    await screen.findByRole("heading", { level: 1, name: "抽選結果" });
    expectFullResults(data);
  });

  it.each([1, 10, 100, 1000] as const)("parses and renders every one of %i results in API order, independently of high_rank_results", async (count) => {
    const data = fullResult(count);
    const harness = createDrawClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `https://storefront.test/platform/draw-requests/${data.id}` },
      { body: data, status: 200 },
    );
    renderResult(harness.client);
    fireEvent.ended(await screen.findByLabelText("代表演出動画"));
    expectFullResults(data);
    expect(data.high_rank_results).toHaveLength(Math.min(20, count));
    expect(harness.mock.requests).toHaveLength(1);
    harness.mock.assertExhausted();
  }, 20_000);

  it.each(["skip", "ended"])("stays in results after %s across rerender; a fresh mount plays again", async (event) => {
    const data = fullResult(10);
    const auth = authClient();
    const client = drawClient({ getDrawRequest: vi.fn().mockResolvedValue(response(data)) });
    const tree = (adapter: DrawClientAdapter, id = result.id) => (
      <SessionProvider client={auth}>
        <RefreshSession /><DrawClientProvider client={adapter}><DrawResultView drawRequestId={id} /></DrawClientProvider>
      </SessionProvider>
    );
    const view = render(tree(client));
    const video = await screen.findByLabelText("代表演出動画");
    if (event === "skip") fireEvent.click(screen.getByRole("button", { name: "スキップ" }));
    else fireEvent.ended(video);
    view.rerender(tree(client));
    expectFullResults(data);
    fireEvent.click(screen.getByRole("button", { name: "Refresh session" }));
    await screen.findByRole("heading", { level: 1, name: "抽選結果" });
    await waitFor(() => expect(client.getDrawRequest).toHaveBeenCalledTimes(2));
    expectFullResults(data);
    view.unmount();
    render(tree(client));
    expect(await screen.findByLabelText("代表演出動画")).toHaveAttribute("src", representative.video_snapshot.path);
    expect(document.querySelectorAll(".draw-snapshot-card")).toHaveLength(0);
    expect(client.getDrawRequest).toHaveBeenCalledTimes(3);
  });

  it("starts with loading and a new presentation when navigating to another request", async () => {
    const data = fullResult(10);
    const client = drawClient({ getDrawRequest: vi.fn().mockResolvedValue(response(data)) });
    const auth = authClient();
    const tree = (id: string) => <SessionProvider client={auth}><DrawClientProvider client={client}><DrawResultView drawRequestId={id} /></DrawClientProvider></SessionProvider>;
    const view = render(tree(result.id));
    fireEvent.ended(await screen.findByLabelText("代表演出動画"));
    view.rerender(tree("another-request"));
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(document.querySelectorAll("video, .draw-snapshot-card")).toHaveLength(0);
    expect(await screen.findByLabelText("代表演出動画")).toBeInTheDocument();
    expect(client.getDrawRequest).toHaveBeenLastCalledWith("another-request");
  });

  it("preserves only the legacy missing-results fallback and never substitutes an empty new results array", async () => {
    const data = fullResult(10);
    delete data.results;
    delete data.presentation;
    const legacy = renderResult(drawClient({ getDrawRequest: vi.fn().mockResolvedValue(response(data)) }));
    await screen.findByRole("heading", { level: 1, name: "抽選結果" });
    expect(document.querySelectorAll(".draw-snapshot-card")).toHaveLength(10);
    expect(document.querySelectorAll("video")).toHaveLength(0);
    legacy.unmount();
    renderResult(drawClient({ getDrawRequest: vi.fn().mockResolvedValue(response({ ...data, results: [] })) }));
    await screen.findByRole("heading", { level: 1, name: "抽選結果" });
    expect(document.querySelectorAll(".draw-snapshot-card")).toHaveLength(0);
  });
});

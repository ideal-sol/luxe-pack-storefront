import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_DRAW_FIXTURE,
  PUBLIC_PARTIAL_REMAINING_DRAW_FIXTURE,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import { DrawResultView } from "@/components/draw/draw-result";
import type { AuthClientAdapter, DrawClientAdapter, DrawResponse } from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;
const result = PUBLIC_DRAW_FIXTURE as DrawResponse;
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
) {
  return render(
    <SessionProvider client={authClient(authenticated)}>
      <DrawClientProvider client={client}>
        <DrawResultView drawRequestId={result.id} />
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

  it("renders the prize thumbnail, rank lineup image, and existing video snapshot", async () => {
    const getDrawRequest = vi.fn().mockResolvedValue(response(snapshotResult));
    renderResult(drawClient({ getDrawRequest }));

    expect(await screen.findByRole("img", { name: drawSnapshot.rank_lineup_image.alt_text })).toHaveAttribute("src", expect.stringContaining(drawSnapshot.rank_lineup_image.path));
    expect(screen.queryByText(drawSnapshot.rank.name)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: drawSnapshot.prize.presentation_asset.alt_text }).getAttribute("src")
      ?.endsWith(drawSnapshot.prize.presentation_asset.path)).toBe(true);
    expect(screen.getByLabelText(drawSnapshot.video_snapshot.alt_text!))
      .toHaveAttribute("src", drawSnapshot.video_snapshot.path);
    expect(getDrawRequest).toHaveBeenCalledTimes(1);
    expect(getDrawRequest).toHaveBeenCalledWith(result.id);
  });

  it("keeps the snapshot Rank image and result visible when snapshot video playback fails", async () => {
    renderResult(drawClient({ getDrawRequest: vi.fn().mockResolvedValue(response(snapshotResult)) }));

    const video = await screen.findByLabelText(drawSnapshot.video_snapshot.alt_text!);
    fireEvent.error(video);
    await waitFor(() => expect(screen.queryByLabelText(drawSnapshot.video_snapshot.alt_text!)).not.toBeInTheDocument());
    expect(screen.getByRole("img", { name: drawSnapshot.rank_lineup_image.alt_text })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: drawSnapshot.prize.presentation_asset.alt_text })).toBeInTheDocument();
    expect(screen.getAllByText(drawSnapshot.prize!.name)).toHaveLength(2);
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
    expect(screen.getByText(`× ${result.prize_counts[0]!.count}`)).toBeInTheDocument();
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
    const partial = PUBLIC_PARTIAL_REMAINING_DRAW_FIXTURE.response as DrawResponse;
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

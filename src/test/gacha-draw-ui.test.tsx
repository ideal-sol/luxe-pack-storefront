import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import {
  PUBLIC_CATALOG_FIXTURE,
  PUBLIC_DRAW_FIXTURE,
  PUBLIC_DRAW_PROBLEM_FIXTURES,
  PUBLIC_GACHA_PRESENTATION_FIXTURE,
  PUBLIC_PARTIAL_REMAINING_DRAW_FIXTURE,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import { GachaDrawPanel } from "@/components/draw/gacha-draw-panel";
import type {
  DrawClientAdapter,
  DrawResponse,
  GachaDetail,
  GachaPresentationState,
} from "@/lib/platform";

const { push, refreshWallet } = vi.hoisted(() => ({ push: vi.fn(), refreshWallet: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/points/point-client-provider", () => ({ usePointClient: () => ({ refreshWallet }) }));

const detail = PUBLIC_CATALOG_FIXTURE.data as GachaDetail;
const presentation = PUBLIC_GACHA_PRESENTATION_FIXTURE.data as GachaPresentationState;
const drawResponse = PUBLIC_DRAW_FIXTURE as DrawResponse;
const metadata = { idempotency_replayed: false, status: 200 } as const;

function response(data: DrawResponse) {
  return { data, metadata };
}

function client(createDraw = vi.fn().mockResolvedValue(response(drawResponse))): DrawClientAdapter {
  return { createDraw, getDrawRequest: vi.fn(), listDrawHistory: vi.fn() } as DrawClientAdapter;
}

function renderPanel(drawClient: DrawClientAdapter | null = client()) {
  return render(
    <DrawClientProvider client={drawClient}>
      <GachaDrawPanel detail={detail} presentation={presentation} />
    </DrawClientProvider>,
  );
}

function confirmOneDraw() {
  fireEvent.click(screen.getByRole("button", { name: "1回抽選する" }));
  fireEvent.click(screen.getByRole("button", { name: "抽選を実行する" }));
}

describe("Gacha Draw execution UI", () => {
  beforeEach(() => {
    push.mockReset();
    refreshWallet.mockClear();
  });

  it("uses only Presentation counts and navigates with the canonical Draw ID", async () => {
    const createDraw = vi.fn().mockResolvedValue(response(drawResponse));
    renderPanel(client(createDraw));
    expect(screen.getByRole("button", { name: "1回" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5回" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10回" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "100回" })).not.toBeInTheDocument();

    confirmOneDraw();
    await waitFor(() => expect(createDraw).toHaveBeenCalledTimes(1));
    const [gachaId, count, options] = createDraw.mock.calls[0]!;
    expect(gachaId).toBe(detail.id);
    expect(count).toBe(1);
    expect(options.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
    expect(refreshWallet).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith(`/draws/${drawResponse.id}/result`);
    expect(screen.queryByText(/Platformの応答を正本/)).not.toBeInTheDocument();
  });

  it("blocks a double click while the same Draw is pending", async () => {
    let resolveDraw: ((value: ReturnType<typeof response>) => void) | undefined;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => { resolveDraw = resolve; });
    const createDraw = vi.fn(() => pending);
    renderPanel(client(createDraw));
    fireEvent.click(screen.getByRole("button", { name: "1回抽選する" }));
    const confirm = screen.getByRole("button", { name: "抽選を実行する" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(createDraw).toHaveBeenCalledTimes(1);
    resolveDraw?.(response(drawResponse));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });

  it("renders every Backend count even when remaining is below the selected 1000", async () => {
    const partialPresentation = {
      ...PUBLIC_PARTIAL_REMAINING_DRAW_FIXTURE.presentation,
      allowed_draw_counts: [...PUBLIC_PARTIAL_REMAINING_DRAW_FIXTURE.presentation.allowed_draw_counts],
    } satisfies GachaPresentationState;
    const partialDetail = { ...detail, remaining_count: 900 } satisfies GachaDetail;
    const createDraw = vi.fn().mockResolvedValue(response(PUBLIC_PARTIAL_REMAINING_DRAW_FIXTURE.response as DrawResponse));
    render(
      <DrawClientProvider client={client(createDraw)}>
        <GachaDrawPanel detail={partialDetail} presentation={partialPresentation} />
      </DrawClientProvider>,
    );

    expect(screen.getByRole("button", { name: "1回" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "100回" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1,000回" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "5回" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "10回" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1,000回" }));
    fireEvent.click(screen.getByRole("button", { name: "1,000回抽選する" }));
    fireEvent.click(screen.getByRole("button", { name: "抽選を実行する" }));
    await waitFor(() => expect(createDraw).toHaveBeenCalledTimes(1));
    expect(createDraw.mock.calls[0]?.[1]).toBe(1000);
  });

  it("reuses the same key after an uncertain network failure", async () => {
    const createDraw = vi.fn()
      .mockRejectedValueOnce(new StorefrontTransportError("NETWORK_ERROR", "network"))
      .mockResolvedValueOnce(response(drawResponse));
    renderPanel(client(createDraw));
    confirmOneDraw();
    expect(await screen.findByRole("alert")).toHaveTextContent("同じ操作のまま");
    confirmOneDraw();
    await waitFor(() => expect(createDraw).toHaveBeenCalledTimes(2));
    expect(createDraw.mock.calls[1]?.[2].idempotency_key).toBe(createDraw.mock.calls[0]?.[2].idempotency_key);
  });

  it("creates a new key after changing to a new operation", async () => {
    const pointProblem = new ApiProblemError(PUBLIC_DRAW_PROBLEM_FIXTURES[0]);
    const createDraw = vi.fn()
      .mockRejectedValueOnce(pointProblem)
      .mockResolvedValueOnce(response(drawResponse));
    renderPanel(client(createDraw));
    confirmOneDraw();
    expect(await screen.findByText("コインが不足しているため抽選できません。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "5回" }));
    fireEvent.click(screen.getByRole("button", { name: "5回抽選する" }));
    fireEvent.click(screen.getByRole("button", { name: "抽選を実行する" }));
    await waitFor(() => expect(createDraw).toHaveBeenCalledTimes(2));
    expect(createDraw.mock.calls[1]?.[2].idempotency_key).not.toBe(createDraw.mock.calls[0]?.[2].idempotency_key);
  });

  it.each([
    ["GACHA_AUDIENCE_NOT_ELIGIBLE", "対象条件"],
    ["DAILY_DRAW_LIMIT_EXCEEDED", "本日の抽選上限"],
    ["GACHA_NOT_DRAWABLE", "現在抽選できません"],
    ["GACHA_SALES_PAUSED", "販売を停止"],
    ["IDEMPOTENCY_KEY_REUSED", "使用済み"],
    ["IDEMPOTENCY_REQUEST_IN_PROGRESS", "抽選処理を確認"],
  ] as const)("presents the generated %s problem safely", async (code, expected) => {
    const problem = new ApiProblemError({
      code,
      request_id: `request-${code}`,
      retryable: code === "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      status: 409,
      title: "server title must not be shown",
      type: "https://storefront.test/problems/draw",
    });
    renderPanel(client(vi.fn().mockRejectedValue(problem)));
    confirmOneDraw();
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.queryByText("server title must not be shown")).not.toBeInTheDocument();
  });

  it("uses a safe generic message for an unknown Draw problem", async () => {
    const unknown = new ApiProblemError({
      code: "FUTURE_DRAW_CODE",
      detail: "sensitive backend detail",
      request_id: "request-unknown",
      retryable: false,
      status: 409,
      title: "Unknown",
      type: "https://storefront.test/problems/future",
    });
    renderPanel(client(vi.fn().mockRejectedValue(unknown)));
    confirmOneDraw();
    expect(await screen.findByRole("alert")).toHaveTextContent("抽選を完了できませんでした");
    expect(screen.queryByText("sensitive backend detail")).not.toBeInTheDocument();
  });

  it("does not offer mutation when the Draw configuration is unavailable", () => {
    renderPanel(null);
    expect(screen.getByRole("button", { name: "1回抽選する" })).toBeDisabled();
    expect(screen.getByText("エラーが発生しました、運営までお問い合わせください")).toBeInTheDocument();
    expect(screen.queryByText(/Platform|抽選条件と消費コイン/)).not.toBeInTheDocument();
  });

  it.each([
    ["sold_out", "sold_out", "hidden", "SOLD OUT"],
    ["ended", "sale_ended", "hidden", "販売終了"],
    ["coming_soon", "sale_not_started", "disabled", "販売開始前"],
    ["on_sale", "audience_not_eligible", "disabled", "対象外"],
  ] as const)("keeps a disabled fixed tray for the canonical %s state", (saleState, reason, ctaState, label) => {
    const createDraw = vi.fn();
    const blocked = {
      ...presentation,
      allowed_draw_counts: [],
      cta: { action: ctaState === "hidden" ? null : "draw", reason, state: ctaState },
      eligible: false,
      ineligible_reason: reason,
      sale_state: saleState,
    } satisfies GachaPresentationState;

    render(
      <DrawClientProvider client={client(createDraw)}>
        <GachaDrawPanel detail={detail} presentation={blocked} />
      </DrawClientProvider>,
    );
    const disabled = screen.getByRole("button", { name: label });
    expect(screen.getByLabelText("抽選オプション")).toHaveAttribute("data-cta-state", ctaState);
    expect(screen.queryByLabelText("抽選回数")).not.toBeInTheDocument();
    expect(disabled).toBeDisabled();
    fireEvent.click(disabled);
    expect(createDraw).not.toHaveBeenCalled();
  });
});

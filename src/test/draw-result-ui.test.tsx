import { render, screen, waitFor } from "@testing-library/react";
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
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    requestPasswordReset: vi.fn(),
    resendEmailVerification: vi.fn(),
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
    expect(screen.getByText("PRIZE IMAGE")).toBeInTheDocument();
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
      prize: { ...result.prize_counts[0]!.prize, id: "0198a001-0000-7000-8000-000000000010", name: "Fixture A景品" },
      rank: { id: "0198a001-0000-7000-8000-000000000004", code: "A", name: "Aランク" },
    };
    const multiple = { ...result, prize_counts: [result.prize_counts[0]!, second] } satisfies DrawResponse;
    renderResult(drawClient({ getDrawRequest: vi.fn().mockResolvedValue(response(multiple)) }));
    expect(await screen.findByText("Fixture A景品")).toBeInTheDocument();
    expect(screen.getByText(result.prize_counts[0]!.prize.name)).toBeInTheDocument();
    expect(screen.getAllByText("PRIZE IMAGE")).toHaveLength(2);
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

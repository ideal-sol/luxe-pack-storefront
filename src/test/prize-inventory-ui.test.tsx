import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_USER_PRIZE_FIXTURE } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { PrizeClientProvider } from "@/components/prizes/prize-client-provider";
import { PrizeInventory } from "@/components/prizes/prize-inventory";
import type { AuthClientAdapter, AuthSession, PrizeInventoryAdapter, UserPrize } from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;
const authenticated = PUBLIC_AUTH_FIXTURE.authenticated_session;
const base = PUBLIC_USER_PRIZE_FIXTURE as UserPrize;

function response<T>(data: T) {
  return { data, metadata };
}

function authClient(authenticatedSession: AuthSession = authenticated): AuthClientAdapter {
  return {
    completeEmailVerification: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(response(authenticatedSession)),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    resendEmailVerification: vi.fn(),
  } as AuthClientAdapter;
}

function prize(overrides: Partial<UserPrize> & { readonly id: string; readonly name: string }): UserPrize {
  const { name, ...userPrizeOverrides } = overrides;
  return {
    ...base,
    ...userPrizeOverrides,
    presentation: {
      ...base.presentation!,
      ...(overrides.presentation ?? {}),
      name,
    },
  };
}

const both = prize({ id: "0198a001-0000-7000-8000-000000000201", name: "両方可能な景品" });
const shippingOnly = prize({
  allowed_actions: {
    point_exchange: { allowed: false, unavailable_reason: "exchange_points_unavailable" },
    selection: { allowed: true, unavailable_reason: null },
    shipping: { allowed: true, unavailable_reason: null },
  },
  id: "0198a001-0000-7000-8000-000000000202",
  name: "発送のみ可能な景品",
  presentation: { ...base.presentation!, image: null },
});
const denied = prize({
  allowed_actions: {
    point_exchange: { allowed: false, unavailable_reason: "status_not_actionable" },
    selection: { allowed: false, unavailable_reason: "payment_hold" },
    shipping: { allowed: false, unavailable_reason: "status_not_actionable" },
  },
  id: "0198a001-0000-7000-8000-000000000203",
  name: "選択不可の景品",
});

function client(overrides: Partial<PrizeInventoryAdapter> = {}): PrizeInventoryAdapter {
  return {
    getPrize: vi.fn(),
    listPrizes: vi.fn().mockResolvedValue(response({ items: [both, shippingOnly, denied], next_cursor: null })),
    ...overrides,
  } as PrizeInventoryAdapter;
}

function renderInventory(prizeClient: PrizeInventoryAdapter | null = client(), auth: AuthClientAdapter | null = authClient()) {
  return render(
    <SessionProvider client={auth}>
      <PrizeClientProvider client={prizeClient}>
        <PrizeInventory />
      </PrizeClientProvider>
    </SessionProvider>,
  );
}

describe("prize inventory UI", () => {
  it("renders generated presentation, status, rank, dates, points, and image fallback", async () => {
    renderInventory();
    expect(await screen.findByRole("heading", { name: "両方可能な景品" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "発送のみ可能な景品" })).toBeInTheDocument();
    expect(screen.getAllByText("保管中")).toHaveLength(3);
    expect(screen.getAllByText(base.presentation!.rank.name)).toHaveLength(3);
    expect(screen.getAllByText(`${base.exchange_points.toLocaleString()}pt`)).toHaveLength(3);
    expect(screen.getAllByText("PRIZE IMAGE")).toHaveLength(3);
    expect(screen.getByText("お支払い状況の確認中です。")).toBeInTheDocument();
  });

  it("selects only selection.allowed items and resets selection", async () => {
    renderInventory();
    const bothCheckbox = await screen.findByRole("checkbox", { name: "両方可能な景品を選択" });
    const deniedCheckbox = screen.getByRole("checkbox", { name: "選択不可の景品を選択" });
    expect(deniedCheckbox).toBeDisabled();
    fireEvent.click(bothCheckbox);
    expect(bothCheckbox).toBeChecked();
    expect(screen.getByRole("button", { name: "ポイントに交換" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "発送を依頼" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "全て選択" }));
    expect(screen.getByRole("checkbox", { name: "発送のみ可能な景品を選択" })).toBeChecked();
    expect(deniedCheckbox).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "ポイントに交換" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "発送を依頼" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "リセット" }));
    expect(screen.queryByLabelText("選択した景品の操作")).not.toBeInTheDocument();
  });

  it("renders no action when selected items have no Backend-common action", async () => {
    const selectionOnly = prize({
      allowed_actions: {
        point_exchange: { allowed: false, unavailable_reason: "exchange_points_unavailable" },
        selection: { allowed: true, unavailable_reason: null },
        shipping: { allowed: false, unavailable_reason: "status_not_actionable" },
      },
      id: "0198a001-0000-7000-8000-000000000204",
      name: "共通操作なしの景品",
    });
    renderInventory(client({ listPrizes: vi.fn().mockResolvedValue(response({ items: [selectionOnly], next_cursor: null })) }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "共通操作なしの景品を選択" }));
    expect(screen.getByText("選択中の景品に共通して利用できる操作はありません。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "発送を依頼" })).not.toBeInTheDocument();
  });

  it("loads the next cursor without invoking a mutation", async () => {
    const listPrizes = vi.fn()
      .mockResolvedValueOnce(response({ items: [both], next_cursor: "next-page" }))
      .mockResolvedValueOnce(response({ items: [shippingOnly], next_cursor: null }));
    const prizeClient = client({ listPrizes });
    renderInventory(prizeClient);
    fireEvent.click(await screen.findByRole("button", { name: "さらに表示" }));
    expect(await screen.findByRole("heading", { name: "発送のみ可能な景品" })).toBeInTheDocument();
    expect(listPrizes).toHaveBeenNthCalledWith(1);
    expect(listPrizes).toHaveBeenNthCalledWith(2, "next-page");
    expect(Object.keys(prizeClient).sort()).toEqual(["getPrize", "listPrizes"]);
  });

  it("distinguishes loading, empty, typed error, configuration, and login required", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderInventory(client({ listPrizes: vi.fn(() => pending) }));
    expect(await screen.findByRole("status")).toHaveTextContent("獲得景品を読み込み中");
    loading.unmount();

    const empty = renderInventory(client({ listPrizes: vi.fn().mockResolvedValue(response({ items: [], next_cursor: null })) }));
    expect(await screen.findByText("獲得景品はありません")).toBeInTheDocument();
    empty.unmount();

    const problem = new ApiProblemError({
      code: "PRIZE_UNAVAILABLE",
      request_id: "request-prize-error",
      retryable: true,
      status: 503,
      title: "Prize unavailable",
      type: "https://storefront.test/problems/prize-unavailable",
    });
    const error = renderInventory(client({ listPrizes: vi.fn().mockRejectedValue(problem) }));
    expect(await screen.findByText("獲得景品を取得できませんでした")).toBeInTheDocument();
    error.unmount();

    const missingConfig = renderInventory(null);
    expect(await screen.findByText("獲得景品を表示できません")).toBeInTheDocument();
    missingConfig.unmount();

    renderInventory(client(), authClient(PUBLIC_AUTH_FIXTURE.anonymous_session));
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログインへ" })).toHaveAttribute("href", "/login");
  });

  it("reports a cursor error without discarding already loaded prizes", async () => {
    const listPrizes = vi.fn()
      .mockResolvedValueOnce(response({ items: [both], next_cursor: "next-page" }))
      .mockRejectedValueOnce(new ApiProblemError({
        code: "PRIZE_UNAVAILABLE",
        request_id: "request-prize-cursor",
        retryable: true,
        status: 503,
        title: "Prize unavailable",
        type: "https://storefront.test/problems/prize-unavailable",
      }));
    renderInventory(client({ listPrizes }));
    fireEvent.click(await screen.findByRole("button", { name: "さらに表示" }));
    await waitFor(() => expect(screen.getByText(/時間をおいて/)).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "両方可能な景品" })).toBeInTheDocument();
  });
});

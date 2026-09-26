import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_USER_PRIZE_FIXTURE, PUBLIC_SHIPPING_ONLY_PRIZE_FIXTURE } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { PrizeClientProvider } from "@/components/prizes/prize-client-provider";
import { PrizeInventory } from "@/components/prizes/prize-inventory";
import type { AuthClientAdapter, AuthSession, PrizeFulfillmentAdapter, UserPrize } from "@/lib/platform";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const metadata = { idempotency_replayed: false, status: 200 } as const;
const authenticated = PUBLIC_AUTH_FIXTURE.authenticated_session;
const base = PUBLIC_USER_PRIZE_FIXTURE as UserPrize;

function response<T>(data: T) {
  return { data, metadata };
}

function authClient(authenticatedSession: AuthSession = authenticated, overrides: Partial<AuthClientAdapter> = {}): AuthClientAdapter {
  return {
    changeUserPassword: vi.fn(),
    completeEmailChange: vi.fn(),
    completeEmailVerification: vi.fn(),
    confirmPasswordReset: vi.fn(),
    createEmailChangeRequest: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(response(authenticatedSession)),
    getSmsVerificationStatus: vi.fn().mockResolvedValue(response({ challenge: null, phone: "+819012345678", phone_masked: "+819****5678", verified: true, verified_at: "2026-09-02T10:00:00Z" })),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    reauthenticateUserPassword: vi.fn(),
    requestPasswordReset: vi.fn(),
    resendEmailVerification: vi.fn(),
    resendSmsVerification: vi.fn(),
    sendSmsVerification: vi.fn(),
    verifySmsCode: vi.fn(),
    ...overrides,
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
const pointOnly = prize({
  allowed_actions: {
    point_exchange: { allowed: true, unavailable_reason: null },
    selection: { allowed: true, unavailable_reason: null },
    shipping: { allowed: false, unavailable_reason: "status_not_actionable" },
  },
  id: "0198a001-0000-7000-8000-000000000204",
  name: "ポイント交換のみ可能な景品",
});

function client(overrides: Partial<PrizeFulfillmentAdapter> = {}): PrizeFulfillmentAdapter {
  return {
    createShippingAddress: vi.fn(),
    createShippingRequest: vi.fn(),
    deleteShippingAddress: vi.fn(),
    exchangePrizes: vi.fn(),
    getPrize: vi.fn(),
    getShippingAddress: vi.fn(),
    getShippingRequest: vi.fn(),
    listPrizes: vi.fn().mockResolvedValue(response({ items: [both, shippingOnly, denied], next_cursor: null })),
    listShippingAddresses: vi.fn().mockResolvedValue(response({ items: [] })),
    listShippingRequests: vi.fn().mockResolvedValue(response({ items: [], next_cursor: null })),
    updateShippingAddress: vi.fn(),
    ...overrides,
  } as PrizeFulfillmentAdapter;
}

function renderInventory(prizeClient: PrizeFulfillmentAdapter | null = client(), auth: AuthClientAdapter | null = authClient()) {
  return render(
    <SessionProvider client={auth}>
      <PrizeClientProvider client={prizeClient}>
        <PrizeInventory />
      </PrizeClientProvider>
    </SessionProvider>,
  );
}

describe("prize inventory UI", () => {
  it("excludes shipping-only snapshots from exchange selection, counts, totals and payload while retaining shipping", async () => {
    const a = prize({ id: "A", name: "通常A", exchange_points: 100, shipping_only: false });
    const b = prize({ id: "B", name: "通常B", exchange_points: 500, shipping_only: false });
    const c = prize({ ...PUBLIC_SHIPPING_ONLY_PRIZE_FIXTURE, id: "C", name: "配送専用C", exchange_points: 9000 });
    const fulfillment = client({
      listPrizes: vi.fn().mockResolvedValue(response({ items: [a, b, c], next_cursor: null })),
      exchangePrizes: vi.fn().mockResolvedValue(response({ exchanged_count: 2, exchange_point_total: 600 })),
    });
    renderInventory(fulfillment);
    expect(await screen.findByText("配送のみ・ポイント交換不可")).toBeInTheDocument();
    const cCheckbox = screen.getByRole("checkbox", { name: "配送専用Cを選択" });
    expect(c.allowed_actions?.selection.allowed).toBe(true);
    fireEvent.click(cCheckbox);
    expect(screen.queryByRole("button", { name: "コインに交換" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "発送を依頼" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "配送対象を全選択" }));
    expect(cCheckbox).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "コイン交換対象を全選択" }));
    expect(cCheckbox).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "通常Aを選択" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "通常Bを選択" })).toBeChecked();
    // A shared selection may still include C: the mutation must filter again.
    fireEvent.click(cCheckbox);
    expect(cCheckbox).toBeChecked();
    expect(screen.getByText("交換対象: 2件 ／ 配送対象: 3件")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "コインに交換" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("選択した景品: 2件");
    expect(screen.getByRole("dialog")).toHaveTextContent("600 コイン");
    fireEvent.click(screen.getByRole("button", { name: "コインに交換する" }));
    await waitFor(() => expect(fulfillment.exchangePrizes).toHaveBeenCalledWith(["A", "B"], { idempotency_key: expect.any(String) }));
    await screen.findByText("手続きが完了しました");
  });

  it("does not grant shipping to an expired shipping-only snapshot", async () => {
    const expired = prize({
      ...PUBLIC_SHIPPING_ONLY_PRIZE_FIXTURE, id: "expired", name: "期限切れ配送景品",
      allowed_actions: {
        selection: { allowed: false, unavailable_reason: "storage_expired" },
        shipping: { allowed: false, unavailable_reason: "storage_expired" },
        point_exchange: { allowed: false, unavailable_reason: "shipping_only" },
      },
    });
    renderInventory(client({ listPrizes: vi.fn().mockResolvedValue(response({ items: [expired], next_cursor: null })) }));
    expect(await screen.findByRole("checkbox")).toBeDisabled();
    expect(screen.getByText("配送のみ・ポイント交換不可")).toBeInTheDocument();
    expect(screen.getByText("保管期限を過ぎています。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "配送対象を全選択" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "コイン交換対象を全選択" })).toBeDisabled();
  });

  it("renders generated presentation, status, rank, dates, Coin values, and image fallback", async () => {
    const view = renderInventory();
    expect(await screen.findByRole("heading", { name: "両方可能な景品" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "発送のみ可能な景品" })).toBeInTheDocument();
    expect(screen.getAllByText("保管中")).toHaveLength(3);
    expect(screen.getAllByText(base.presentation!.rank.name)).toHaveLength(3);
    expect(screen.getAllByText(`${base.exchange_points.toLocaleString()} コイン`)).toHaveLength(3);
    expect(screen.getAllByText("PRIZE IMAGE")).toHaveLength(3);
    expect(screen.getByText("お支払い状況の確認中です。")).toBeInTheDocument();
    expect(view.container).not.toHaveTextContent(/ポイント|\bpt\b/i);
  });

  it("converts only Backend Prize currency terminology without mutating the canonical response", async () => {
    const canonicalName = pointOnly.presentation!.name;
    const view = renderInventory(client({
      listPrizes: vi.fn().mockResolvedValue(response({ items: [pointOnly], next_cursor: null })),
    }));

    expect(await screen.findByRole("heading", { name: "コイン交換のみ可能な景品" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "コイン交換のみ可能な景品を選択" })).toBeInTheDocument();
    expect(pointOnly.presentation!.name).toBe(canonicalName);
    expect(canonicalName).toBe("ポイント交換のみ可能な景品");
    expect(view.container).not.toHaveTextContent(/ポイント|\bpt\b/i);
  });

  it("uses Coin terminology for canonical exchange statuses and unavailable reasons", async () => {
    const converted = prize({
      id: "0198a001-0000-7000-8000-000000000205",
      name: "交換済み景品",
      status: "converted",
    });
    const processing = prize({
      id: "0198a001-0000-7000-8000-000000000206",
      name: "交換処理中景品",
      status: "exchange_processing",
    });
    const unavailable = prize({
      allowed_actions: {
        ...base.allowed_actions!,
        selection: { allowed: false, unavailable_reason: "exchange_points_unavailable" },
      },
      id: "0198a001-0000-7000-8000-000000000207",
      name: "交換額未確定景品",
    });
    const view = renderInventory(client({
      listPrizes: vi.fn().mockResolvedValue(response({ items: [converted, processing, unavailable], next_cursor: null })),
    }));

    expect(await screen.findByText("コイン交換済み")).toBeInTheDocument();
    expect(screen.getByText("コイン交換処理中")).toBeInTheDocument();
    expect(screen.getByText("コイン交換額を確認できません。")).toBeInTheDocument();
    expect(view.container).not.toHaveTextContent(/ポイント|\bpt\b/i);
  });

  it("uses action-specific select-all while retaining individual selection and reset", async () => {
    renderInventory();
    const bothCheckbox = await screen.findByRole("checkbox", { name: "両方可能な景品を選択" });
    const deniedCheckbox = screen.getByRole("checkbox", { name: "選択不可の景品を選択" });
    expect(deniedCheckbox).toBeDisabled();
    fireEvent.click(bothCheckbox);
    expect(bothCheckbox).toBeChecked();
    expect(screen.getByRole("button", { name: "コインに交換" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "発送を依頼" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "配送対象を全選択" }));
    expect(screen.getByRole("checkbox", { name: "発送のみ可能な景品を選択" })).toBeChecked();
    expect(deniedCheckbox).not.toBeChecked();
    expect(screen.getByRole("button", { name: "コインに交換" })).toBeEnabled();
    expect(screen.getByText("交換対象: 1件 ／ 配送対象: 2件")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "発送を依頼" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "リセット" }));
    expect(screen.queryByLabelText("選択した景品の操作")).not.toBeInTheDocument();
  });

  it("warns instead of starting a new shipping request when SMS is unverified", async () => {
    const auth = authClient(authenticated, {
      getSmsVerificationStatus: vi.fn().mockResolvedValue(response({ challenge: null, phone: null, phone_masked: null, verified: false, verified_at: null })),
    });
    const fulfillment = client();
    renderInventory(fulfillment, auth);
    fireEvent.click(await screen.findByRole("checkbox", { name: "両方可能な景品を選択" }));
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("配送依頼にはSMS認証が必要です");
    expect(fulfillment.listShippingAddresses).not.toHaveBeenCalled();
  });

  it("offers each action for its own eligible subset", async () => {
    renderInventory(client({ listPrizes: vi.fn().mockResolvedValue(response({ items: [shippingOnly, pointOnly], next_cursor: null })) }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "発送のみ可能な景品を選択" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "コイン交換のみ可能な景品を選択" }));
    expect(screen.getByText("交換対象: 1件 ／ 配送対象: 1件")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "発送を依頼" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "コインに交換" })).toBeEnabled();
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
    expect(prizeClient.exchangePrizes).not.toHaveBeenCalled();
    expect(prizeClient.createShippingRequest).not.toHaveBeenCalled();
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

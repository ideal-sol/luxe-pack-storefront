import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import { PUBLIC_SHIPPING_REQUEST_FIXTURE, PUBLIC_USER_PRIZE_FIXTURE, PUBLIC_SHIPPING_ONLY_PRIZE_FIXTURE, SHIPPING_MINIMUM_PROBLEM_FIXTURE } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { PrizeFulfillmentDialog } from "@/components/prizes/prize-fulfillment";
import { deferred, policy, policyAccess } from "./fixtures/shipping-policy";
import type { ShippingPolicySnapshot } from "@/lib/platform/shipping-policy";
import type {
  PrizeFulfillmentAdapter,
  ShippingAddress,
  ShippingAddressInput,
  UserPrize,
} from "@/lib/platform";

const { refreshWallet } = vi.hoisted(() => ({ refreshWallet: vi.fn().mockResolvedValue(undefined) }));

const metadata = { idempotency_replayed: false, status: 200 } as const;
const prize = PUBLIC_USER_PRIZE_FIXTURE as UserPrize;
const shippingRequest = PUBLIC_SHIPPING_REQUEST_FIXTURE;
const addressInput: ShippingAddressInput = {
  building: "テストビル101",
  city: "テスト市",
  phone_number: "00000000000",
  postal_code: "0000000",
  prefecture: "テスト県",
  recipient_name: "テスト利用者",
  street: "テスト町1-2-3",
};
const address: ShippingAddress = {
  ...addressInput,
  created_at: "2026-08-01T00:00:00Z",
  id: "0198a001-0000-7000-8000-000000000140",
  updated_at: "2026-08-01T00:00:00Z",
};
const addressSummary = {
  id: address.id,
  phone_number_masked: "***0000",
  postal_code_masked: "***0000",
  recipient_name_masked: "テスト***",
  updated_at: address.updated_at,
};

function response<T>(data: T) {
  return { data, metadata };
}

function client(overrides: Partial<PrizeFulfillmentAdapter> = {}): PrizeFulfillmentAdapter {
  return {
    shippingPolicyAccess: policyAccess(),
    getShippingPolicy: vi.fn().mockResolvedValue(response(policy("0"))),
    createShippingAddress: vi.fn().mockResolvedValue(response(address)),
    createShippingRequest: vi.fn().mockResolvedValue(response(shippingRequest)),
    deleteShippingAddress: vi.fn().mockResolvedValue(response({ deleted: true as const })),
    exchangePrizes: vi.fn().mockResolvedValue(response({
      exchange_point_total: prize.exchange_points,
      exchanged_count: 1,
      id: "0198a001-0000-7000-8000-000000000150",
      idempotent_replay: false,
      status: "completed" as const,
      wallet_free_points_after: 8000,
    })),
    getPrize: vi.fn(),
    getShippingAddress: vi.fn().mockResolvedValue(response(address)),
    getShippingRequest: vi.fn().mockResolvedValue(response({
      ...shippingRequest,
      prize_ids: [prize.id],
      shipping_address: addressInput,
      status_history: [],
      tracking_number: null,
    })),
    listPrizes: vi.fn().mockResolvedValue(response({ items: [prize], next_cursor: null })),
    listShippingAddresses: vi.fn().mockResolvedValue(response({ items: [addressSummary] })),
    listShippingRequests: vi.fn().mockResolvedValue(response({ items: [shippingRequest], next_cursor: null })),
    updateShippingAddress: vi.fn().mockResolvedValue(response(address)),
    ...overrides,
  };
}

function fulfillmentProblem(code: string, retryable: boolean) {
  return new ApiProblemError({
    code,
    detail: "このdetailは画面へ表示してはいけません。",
    request_id: `request-${code}`,
    retryable,
    status: 409,
    title: "Fulfillment problem",
    type: `https://storefront.test/problems/${code.toLowerCase()}`,
  });
}

function renderDialog(action: "point_exchange" | "shipping", fulfillmentClient: PrizeFulfillmentAdapter, selectedItems: readonly UserPrize[] = [prize]) {
  const onClose = vi.fn();
  const onReconcile = vi.fn().mockResolvedValue(undefined);
  const onSmsVerificationRequired = vi.fn();
  const view = render(
    <PrizeFulfillmentDialog
      action={action}
      client={fulfillmentClient}
      onClose={onClose}
      onReconcile={onReconcile}
      onSmsVerificationRequired={onSmsVerificationRequired}
      selectedItems={selectedItems}
    />,
  );
  return { ...view, onClose, onReconcile, onSmsVerificationRequired };
}

describe("prize fulfillment UI", () => {
  it.each([
    [3000, "5000", "2,000", false], [5000, "5000", null, true],
    [7000, "5000", null, true], [0, "0", "1", false], [0, "5000", "5,000", false],
  ])("prechecks total %s and minimum %s inside the existing dialog", async (points, minimum, shortfall, allowed) => {
    const fulfillment = client({ shippingPolicyAccess: policyAccess(policy(minimum)) });
    const view = renderDialog("shipping", fulfillment, [{ ...prize, exchange_points: points }]);
    await screen.findByText(`発送に必要な合計：${BigInt(minimum === "0" ? "1" : minimum).toLocaleString("ja-JP")}コイン`);
    expect(screen.getByText(`選択中の合計：${points.toLocaleString("ja-JP")}コイン`)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "発送を依頼する" });
    if (allowed) {
      await waitFor(() => expect(submit).toBeEnabled());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } else {
      expect(submit).toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent(`あと${shortfall}コイン分の景品が必要です。`);
      expect(screen.getByRole("alert")).toHaveClass("fulfillment-dialog__error");
      fireEvent.click(submit);
      expect(fulfillment.createShippingRequest).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
      expect(view.onClose).toHaveBeenCalledOnce();
    }
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("combines zero and positive shipping-only snapshots and excludes a larger exchange-only snapshot", async () => {
    const denied: UserPrize = { ...prize, id: "exchange-only", exchange_points: 9000, allowed_actions: {
      ...prize.allowed_actions!, shipping: { allowed: false, unavailable_reason: "status_not_actionable" },
    } };
    const fulfillment = client({ shippingPolicyAccess: policyAccess(policy()) });
    renderDialog("shipping", fulfillment, [
      { ...prize, id: "zero", exchange_points: 0 },
      { ...PUBLIC_SHIPPING_ONLY_PRIZE_FIXTURE, id: "shipping-only", exchange_points: 5000 }, denied,
    ]);
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
    expect(screen.getByText("選択中の合計：5,000コイン")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    await screen.findByText("手続きが完了しました");
    expect(fulfillment.createShippingRequest).toHaveBeenCalledWith(address.id, ["zero", "shipping-only"], { idempotency_key: expect.any(String) });
  });

  it("blocks invalid prize values instead of rounding them to zero", async () => {
    renderDialog("shipping", client(), [{ ...prize, exchange_points: Number.MAX_SAFE_INTEGER + 1 }]);
    expect(await screen.findByText("景品の合計を確認できません。最新の景品情報を確認してください。")).toHaveAttribute("role", "alert");
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
  });

  it("renders the exact 100-prize BigInt sum", async () => {
    renderDialog("shipping", client(), Array.from({ length: 100 }, (_, index) => ({ ...prize, id: String(index), exchange_points: Number.MAX_SAFE_INTEGER })));
    expect(await screen.findByText("選択中の合計：900,719,925,474,099,100コイン")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
  });

  it("blocks while loading, hides unsafe failures and permits a manual policy reload", async () => {
    const pending = deferred<ShippingPolicySnapshot>();
    const load = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(policy());
    const access = { ...policyAccess(), load };
    const fulfillment = client({ shippingPolicyAccess: access });
    renderDialog("shipping", fulfillment, [{ ...prize, exchange_points: 5000 }]);
    expect(screen.getByRole("status")).toHaveTextContent("発送条件を読み込み中");
    expect(await screen.findByText("テスト***")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
    await act(async () => pending.reject(new Error("unsafe server detail")));
    expect(await screen.findByRole("alert")).toHaveTextContent("発送条件を取得できませんでした");
    expect(document.body).not.toHaveTextContent("unsafe server detail");
    fireEvent.click(screen.getByRole("button", { name: "発送条件を再読み込み" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
    expect(load).toHaveBeenCalledTimes(2);
    expect(fulfillment.createShippingRequest).not.toHaveBeenCalled();
  });

  it("fails closed when the published policy API is unavailable", async () => {
    const fulfillment = client({ shippingPolicyAccess: { ...policyAccess(), load: vi.fn().mockRejectedValue(new Error("unavailable")) } });
    renderDialog("shipping", fulfillment);
    expect(await screen.findByRole("alert")).toHaveTextContent("発送条件を取得できませんでした");
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
    expect(fulfillment.createShippingRequest).not.toHaveBeenCalled();
  });

  it("offers a safe reload for a missing policy response instead of staying in loading", async () => {
    const load = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(policy("0"));
    const fulfillment = client({ shippingPolicyAccess: { ...policyAccess(), load } });
    renderDialog("shipping", fulfillment);
    expect(await screen.findByRole("alert")).toHaveTextContent("発送条件を取得できませんでした");
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "発送条件を再読み込み" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
    expect(load).toHaveBeenCalledTimes(2);
    expect(fulfillment.createShippingRequest).not.toHaveBeenCalled();
  });

  it.each(["01", "0", "9007199254740992"])("keeps an invalid effective requirement %s blocked", async (effective) => {
    renderDialog("shipping", client({ shippingPolicyAccess: policyAccess({ ...policy(), effective_required_points: effective }) }));
    expect(await screen.findByRole("alert")).toHaveTextContent("発送条件を取得できませんでした");
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
  });

  it("presents a validated server minimum rejection, reloads policy and preserves address and selection", async () => {
    const pending = deferred<ShippingPolicySnapshot>();
    const rejection = { ...SHIPPING_MINIMUM_PROBLEM_FIXTURE, minimum_points: "7000", effective_required_points: "7000", selected_total_points: "5000" };
    const error = new ApiProblemError({ ...rejection, detail: "このdetailは画面へ表示してはいけません。" });
    const load = vi.fn().mockResolvedValueOnce(policy()).mockReturnValueOnce(pending.promise);
    const minimumRejection = policyAccess().minimumRejection;
    const fulfillment = client({ shippingPolicyAccess: { load, minimumRejection }, createShippingRequest: vi.fn().mockRejectedValue(error),
      listShippingAddresses: vi.fn().mockResolvedValue(response({ items: [addressSummary, { ...addressSummary, id: "second-address" }] })),
    });
    const view = renderDialog("shipping", fulfillment, [{ ...prize, exchange_points: 5000 }]);
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
    fireEvent.click(screen.getAllByRole("radio")[1]!);
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("あと2,000コイン分");
    expect(screen.getByRole("alert")).toHaveTextContent("発送に必要な合計：7,000コイン");
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
    expect(screen.getAllByRole("radio")[1]).toBeChecked();
    expect(screen.getByRole("dialog")).toHaveTextContent("選択した景品: 1件");
    expect(view.onReconcile).not.toHaveBeenCalled();
    expect(minimumRejection).toHaveBeenCalledWith(error);
    await act(async () => pending.resolve(policy("7000", 2)));
    expect(screen.getByRole("alert")).toHaveTextContent("あと2,000コイン分");
    expect(screen.getAllByRole("radio")[1]).toBeChecked();
    expect(fulfillment.listShippingAddresses).toHaveBeenCalledOnce();
    expect(fulfillment.createShippingRequest).toHaveBeenCalledOnce();
    expect(document.body).not.toHaveTextContent("このdetail");
  });

  it("does not trust a policy older than the server rejection, including after a failed reload", async () => {
    const rejection = { ...SHIPPING_MINIMUM_PROBLEM_FIXTURE, minimum_points: "7000", effective_required_points: "7000", selected_total_points: "5000" };
    const error = new ApiProblemError(rejection);
    const load = vi.fn().mockResolvedValueOnce(policy()).mockResolvedValueOnce(policy()).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(policy("7000", 2));
    const fulfillment = client({ shippingPolicyAccess: { load, minimumRejection: policyAccess().minimumRejection }, createShippingRequest: vi.fn().mockRejectedValue(error) });
    renderDialog("shipping", fulfillment, [{ ...prize, exchange_points: 5000 }]);
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    await screen.findByRole("button", { name: "発送条件を再読み込み" });
    fireEvent.click(screen.getByRole("button", { name: "発送条件を再読み込み" }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    await screen.findByRole("button", { name: "発送条件を再読み込み" });
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "発送条件を再読み込み" }));
    await screen.findByText("発送に必要な合計：7,000コイン");
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
    expect(fulfillment.createShippingRequest).toHaveBeenCalledOnce();
  });

  it("keeps the same shipping key and payload after an uncertain network result", async () => {
    const createShippingRequest = vi.fn().mockRejectedValueOnce(new StorefrontTransportError("NETWORK_ERROR", "unknown outcome")).mockResolvedValueOnce(response(shippingRequest));
    const fulfillment = client({ createShippingRequest });
    renderDialog("shipping", fulfillment);
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("同じ操作のまま");
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    await screen.findByText("手続きが完了しました");
    expect(createShippingRequest).toHaveBeenCalledTimes(2);
    expect(createShippingRequest.mock.calls[0]).toEqual(createShippingRequest.mock.calls[1]);
    expect(fulfillment.shippingPolicyAccess?.load).toHaveBeenCalledOnce();
  });

  it("uses a new idempotency key when the address payload changes after an uncertain result", async () => {
    const createShippingRequest = vi.fn().mockRejectedValueOnce(new StorefrontTransportError("NETWORK_ERROR", "unknown outcome")).mockResolvedValueOnce(response(shippingRequest));
    const fulfillment = client({ createShippingRequest, listShippingAddresses: vi.fn().mockResolvedValue(response({
      items: [addressSummary, { ...addressSummary, id: "second-address" }],
    })) });
    renderDialog("shipping", fulfillment);
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getAllByRole("radio")[1]!);
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    await screen.findByText("手続きが完了しました");
    expect(createShippingRequest).toHaveBeenCalledTimes(2);
    expect(createShippingRequest.mock.calls[0]?.[0]).toBe(address.id);
    expect(createShippingRequest.mock.calls[1]?.[0]).toBe("second-address");
    expect(createShippingRequest.mock.calls[0]?.[2].idempotency_key).not.toBe(createShippingRequest.mock.calls[1]?.[2].idempotency_key);
  });

  it("rejects policy and minimum errors older than an already accepted revision", async () => {
    const oldError = new ApiProblemError(SHIPPING_MINIMUM_PROBLEM_FIXTURE);
    const load = vi.fn().mockResolvedValueOnce(policy("5000", 3)).mockResolvedValueOnce(policy("10000", 2)).mockResolvedValueOnce(policy("5000", 3));
    const fulfillment = client({ shippingPolicyAccess: { load, minimumRejection: policyAccess().minimumRejection }, createShippingRequest: vi.fn().mockRejectedValue(oldError) });
    renderDialog("shipping", fulfillment, [{ ...prize, exchange_points: 5000 }]);
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("発送条件を取得できませんでした");
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
    expect(screen.queryByText(/あと2,000コイン分/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "発送条件を再読み込み" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
    expect(fulfillment.createShippingRequest).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("radio")).toBeChecked();
  });

  it("retains the safe Server shortage when the current prize snapshot overstates the total", async () => {
    const error = new ApiProblemError(SHIPPING_MINIMUM_PROBLEM_FIXTURE);
    const load = vi.fn().mockResolvedValueOnce(policy("5000", 1)).mockResolvedValueOnce(policy("10000", 2));
    const fulfillment = client({ shippingPolicyAccess: { load, minimumRejection: policyAccess().minimumRejection }, createShippingRequest: vi.fn().mockRejectedValue(error) });
    renderDialog("shipping", fulfillment, [{ ...prize, exchange_points: 12000 }]);
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("alert")).toHaveTextContent("選択中の合計：8,000コイン");
    expect(screen.getByRole("alert")).toHaveTextContent("あと2,000コイン分");
    expect(screen.queryByText("選択中の合計：12,000コイン")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
    expect(fulfillment.createShippingRequest).toHaveBeenCalledOnce();
  });

  it("ignores an old source response and responses after closing or unmounting", async () => {
    const old = deferred<ShippingPolicySnapshot>();
    const latest = deferred<ShippingPolicySnapshot>();
    const first = { ...policyAccess(), load: vi.fn().mockReturnValue(old.promise) };
    const second = { ...policyAccess(), load: vi.fn().mockReturnValue(latest.promise) };
    const props = { action: "shipping" as const, client: client({ shippingPolicyAccess: first }), onClose: vi.fn(), onReconcile: vi.fn(), onSmsVerificationRequired: vi.fn(), selectedItems: [{ ...prize, exchange_points: 5000 }] };
    const view = render(<PrizeFulfillmentDialog {...props} />);
    await waitFor(() => expect(first.load).toHaveBeenCalledOnce());
    view.rerender(<PrizeFulfillmentDialog {...props} client={client({ shippingPolicyAccess: second })} />);
    await waitFor(() => expect(second.load).toHaveBeenCalledOnce());
    await act(async () => latest.resolve(policy("7000")));
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
    await act(async () => old.resolve(policy("0")));
    expect(screen.getByText("発送に必要な合計：7,000コイン")).toBeInTheDocument();
    expect(vi.mocked(first.load).mock.calls[0]?.[0].aborted).toBe(true);
    const afterClose = deferred<ShippingPolicySnapshot>();
    const third = { ...policyAccess(), load: vi.fn().mockReturnValue(afterClose.promise) };
    view.rerender(<PrizeFulfillmentDialog {...props} client={client({ shippingPolicyAccess: third })} />);
    await waitFor(() => expect(third.load).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    view.rerender(<PrizeFulfillmentDialog {...props} action={null} />);
    await act(async () => afterClose.reject(fulfillmentProblem("SMS_VERIFICATION_REQUIRED", false)));
    expect(props.onSmsVerificationRequired).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();
  });

  it("never requests shipping policy for a coin exchange", async () => {
    const fulfillment = client();
    renderDialog("point_exchange", fulfillment);
    fireEvent.click(screen.getByRole("button", { name: "コインに交換する" }));
    await screen.findByText("手続きが完了しました");
    expect(fulfillment.shippingPolicyAccess?.load).not.toHaveBeenCalled();
    expect(screen.queryByText(/発送条件/)).not.toBeInTheDocument();
  });

  it.each(["storage_expired", "payment_hold", "status_not_actionable", "exchange_points_unavailable", "shipping_only"] as const)(
    "never submits a point exchange denied for %s even with selection allowed", async (reason) => {
      const denied: UserPrize = { ...prize, allowed_actions: {
        selection: { allowed: true, unavailable_reason: null },
        shipping: { allowed: true, unavailable_reason: null },
        point_exchange: { allowed: false, unavailable_reason: reason },
      } };
      const fulfillment = client();
      renderDialog("point_exchange", fulfillment, [denied]);
      expect(screen.getByRole("dialog")).toHaveTextContent("選択した景品: 0件");
      expect(screen.getByRole("dialog")).toHaveTextContent("0 コイン");
      const submit = screen.getByRole("button", { name: "コインに交換する" });
      expect(submit).toBeDisabled();
      fireEvent.click(submit);
      expect(fulfillment.exchangePrizes).not.toHaveBeenCalled();
    },
  );

  it("ships an allowed shipping-only snapshot but excludes a denied snapshot", async () => {
    const allowed: UserPrize = { ...PUBLIC_SHIPPING_ONLY_PRIZE_FIXTURE, exchange_points: 2500, id: "shipping-only" };
    const denied: UserPrize = { ...allowed, id: "held", allowed_actions: {
      ...allowed.allowed_actions!, shipping: { allowed: false, unavailable_reason: "payment_hold" },
    } };
    const fulfillment = client();
    renderDialog("shipping", fulfillment, [allowed, denied]);
    await waitFor(() => expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeEnabled());
    expect(screen.getByRole("dialog")).toHaveTextContent("選択した景品: 1件");
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    await waitFor(() => expect(fulfillment.createShippingRequest).toHaveBeenCalledWith(address.id, [allowed.id], { idempotency_key: expect.any(String) }));
    await screen.findByText("手続きが完了しました");
  });

  beforeEach(() => {
    refreshWallet.mockClear();
    document.addEventListener("storefront:wallet-refresh", refreshWallet);
  });

  afterEach(() => document.removeEventListener("storefront:wallet-refresh", refreshWallet));

  it("normalizes a Backend SMS-required shipping Problem to the shared gate callback", async () => {
    const listShippingAddresses = vi.fn().mockRejectedValue(fulfillmentProblem("SMS_VERIFICATION_REQUIRED", false));
    const { onSmsVerificationRequired } = renderDialog("shipping", client({ listShippingAddresses }));
    await waitFor(() => expect(onSmsVerificationRequired).toHaveBeenCalledOnce());
    expect(document.body).not.toHaveTextContent("SMS_VERIFICATION_REQUIRED");
  });

  it("reuses one idempotency key for the same point-exchange retry and reconciles canonical reads", async () => {
    const exchangePrizes = vi.fn()
      .mockRejectedValueOnce(fulfillmentProblem("IDEMPOTENCY_FAILURE", true))
      .mockResolvedValueOnce(response({
        exchange_point_total: prize.exchange_points,
        exchanged_count: 1,
        id: "0198a001-0000-7000-8000-000000000150",
        idempotent_replay: true,
        status: "completed" as const,
        wallet_free_points_after: 8000,
      }));
    const fulfillmentClient = client({ exchangePrizes });
    const { onReconcile } = renderDialog("point_exchange", fulfillmentClient);

    expect(screen.getByRole("heading", { name: "コイン交換を確認" })).toBeInTheDocument();
    expect(screen.getByText(`${prize.exchange_points.toLocaleString()} コイン`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "コインに交換する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("同じ操作のまま再試行");
    expect(onReconcile).not.toHaveBeenCalled();
    expect(refreshWallet).not.toHaveBeenCalled();
    expect(screen.queryByText("手続きが完了しました")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "コインに交換する" }));
    expect(await screen.findByText("手続きが完了しました")).toBeInTheDocument();
    expect(screen.getByText(`${prize.exchange_points.toLocaleString()} コインへ交換しました。`, { exact: false })).toBeInTheDocument();

    expect(exchangePrizes).toHaveBeenCalledTimes(2);
    expect(exchangePrizes.mock.calls[0]?.[1].idempotency_key).toBe(exchangePrizes.mock.calls[1]?.[1].idempotency_key);
    expect(onReconcile).toHaveBeenCalledOnce();
    expect(fulfillmentClient.listShippingAddresses).not.toHaveBeenCalled();
    expect(fulfillmentClient.listShippingRequests).not.toHaveBeenCalled();
    expect(refreshWallet).toHaveBeenCalledOnce();
  });

  it("blocks a second click while a point exchange is in flight", async () => {
    let resolveMutation!: (value: ReturnType<typeof response>) => void;
    const exchangePrizes = vi.fn(() => new Promise((resolve) => { resolveMutation = resolve; }));
    const fulfillmentClient = client({ exchangePrizes: exchangePrizes as PrizeFulfillmentAdapter["exchangePrizes"] });
    renderDialog("point_exchange", fulfillmentClient);

    const submit = screen.getByRole("button", { name: "コインに交換する" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(exchangePrizes).toHaveBeenCalledOnce();
    resolveMutation(response({
      exchange_point_total: prize.exchange_points,
      exchanged_count: 1,
      id: "0198a001-0000-7000-8000-000000000150",
      idempotent_replay: false,
      status: "completed" as const,
      wallet_free_points_after: 8000,
    }));
    expect(await screen.findByText("手続きが完了しました")).toBeInTheDocument();
    expect(refreshWallet).toHaveBeenCalledOnce();
  });

  it("uses typed fulfillment problems without exposing Backend detail", async () => {
    const fulfillmentClient = client({
      exchangePrizes: vi.fn().mockRejectedValue(fulfillmentProblem("PRIZE_ON_PAYMENT_HOLD", false)),
    });
    const { onReconcile } = renderDialog("point_exchange", fulfillmentClient);
    fireEvent.click(screen.getByRole("button", { name: "コインに交換する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("お支払い状況の確認中");
    expect(screen.queryByText(/このdetail/)).not.toBeInTheDocument();
    expect(fulfillmentClient.exchangePrizes).toHaveBeenCalledOnce();
    expect(onReconcile).not.toHaveBeenCalled();
    expect(fulfillmentClient.listShippingAddresses).not.toHaveBeenCalled();
    expect(fulfillmentClient.listShippingRequests).not.toHaveBeenCalled();
    expect(screen.queryByText("手続きが完了しました")).not.toBeInTheDocument();
    expect(refreshWallet).not.toHaveBeenCalled();
  });

  it("presents a typed non-exchangeable problem with Coin terminology", async () => {
    const fulfillmentClient = client({
      exchangePrizes: vi.fn().mockRejectedValue(fulfillmentProblem("PRIZE_NOT_EXCHANGEABLE", false)),
    });
    const view = renderDialog("point_exchange", fulfillmentClient);
    fireEvent.click(screen.getByRole("button", { name: "コインに交換する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("選択した景品はコイン交換できません。");
    expect(document.body).not.toHaveTextContent(/ポイント|\bpt\b/i);
    expect(view.onReconcile).not.toHaveBeenCalled();
  });

  it("creates a shipping request and re-fetches shipping, prize, and address state", async () => {
    const fulfillmentClient = client();
    const { onReconcile } = renderDialog("shipping", fulfillmentClient);
    expect(await screen.findByText("テスト***")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新しいお届け先" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    expect(await screen.findByText("手続きが完了しました")).toBeInTheDocument();
    expect(fulfillmentClient.createShippingRequest).toHaveBeenCalledWith(
      address.id,
      [prize.id],
      { idempotency_key: expect.any(String) },
    );
    expect(fulfillmentClient.getShippingRequest).toHaveBeenCalledWith(shippingRequest.id);
    expect(fulfillmentClient.createShippingRequest).toHaveBeenCalledOnce();
    expect(fulfillmentClient.listShippingRequests).toHaveBeenCalledOnce();
    expect(fulfillmentClient.listShippingAddresses).toHaveBeenCalledTimes(2);
    expect(onReconcile).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toHaveTextContent("景品・発送・お届け先は最新の情報を表示しています。");
    expect(fulfillmentClient.exchangePrizes).not.toHaveBeenCalled();
    expect(refreshWallet).not.toHaveBeenCalled();
  });

  it("blocks shipping for the canonical empty address collection and navigates to registration", async () => {
    const createShippingRequest = vi.fn();
    const fulfillmentClient = client({
      createShippingRequest,
      listShippingAddresses: vi.fn().mockResolvedValue(response({ items: [] })),
    });
    renderDialog("shipping", fulfillmentClient);
    expect(await screen.findByText("登録済みのお届け先はありません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新しいお届け先" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "お届け先を登録する" })).toHaveAttribute("href", "/mypage/address");
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    expect(createShippingRequest).not.toHaveBeenCalled();
    expect(fulfillmentClient.createShippingAddress).not.toHaveBeenCalled();
  });

  it("does not infer an empty address state when the canonical list fails", async () => {
    const fulfillmentClient = client({
      listShippingAddresses: vi.fn().mockRejectedValue(fulfillmentProblem("AUTHENTICATION_REQUIRED", false)),
    });
    renderDialog("shipping", fulfillmentClient);
    expect(await screen.findByRole("alert")).toHaveTextContent("セッションを確認できません");
    expect(screen.queryByText("登録済みのお届け先はありません")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "お届け先を登録する" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "発送を依頼する" })).toBeDisabled();
  });

  it("reconciles an uncertain address update before deciding whether to retry", async () => {
    const updated = { ...address, street: "テスト町9-9-9", updated_at: "2026-08-02T00:00:00Z" };
    const getShippingAddress = vi.fn()
      .mockResolvedValueOnce(response(address))
      .mockResolvedValueOnce(response(updated));
    const updateShippingAddress = vi.fn().mockRejectedValue(
      new StorefrontTransportError("NETWORK_ERROR", "network result unknown"),
    );
    const fulfillmentClient = client({ getShippingAddress, updateShippingAddress });
    renderDialog("shipping", fulfillmentClient);
    expect(await screen.findByText("テスト***")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    fireEvent.change(await screen.findByLabelText("番地"), { target: { value: updated.street } });
    fireEvent.click(screen.getByRole("button", { name: "お届け先を保存" }));
    await waitFor(() => expect(getShippingAddress).toHaveBeenCalledTimes(2));
    expect(updateShippingAddress).toHaveBeenCalledOnce();
    expect(screen.queryByText("更新結果を確認できません")).not.toBeInTheDocument();
  });

  it("reconciles an uncertain address delete and never resends the mutation", async () => {
    const listShippingAddresses = vi.fn()
      .mockResolvedValueOnce(response({ items: [addressSummary] }))
      .mockResolvedValue(response({ items: [] }));
    const deleteShippingAddress = vi.fn().mockRejectedValue(
      new StorefrontTransportError("TIMEOUT", "delete result unknown"),
    );
    const fulfillmentClient = client({ deleteShippingAddress, listShippingAddresses });
    renderDialog("shipping", fulfillmentClient);
    expect(await screen.findByText("テスト***")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    await waitFor(() => expect(listShippingAddresses).toHaveBeenCalledTimes(3));
    expect(deleteShippingAddress).toHaveBeenCalledOnce();
    expect(screen.queryByText("削除結果を確認できません")).not.toBeInTheDocument();
  });
});

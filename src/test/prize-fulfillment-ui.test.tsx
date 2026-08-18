import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import { PUBLIC_SHIPPING_REQUEST_FIXTURE, PUBLIC_USER_PRIZE_FIXTURE } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { PrizeFulfillmentDialog } from "@/components/prizes/prize-fulfillment";
import type {
  PrizeFulfillmentAdapter,
  ShippingAddress,
  ShippingAddressInput,
  UserPrize,
} from "@/lib/platform";

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
  } as PrizeFulfillmentAdapter;
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

function renderDialog(action: "point_exchange" | "shipping", fulfillmentClient: PrizeFulfillmentAdapter) {
  const onClose = vi.fn();
  const onReconcile = vi.fn().mockResolvedValue(undefined);
  render(
    <PrizeFulfillmentDialog
      action={action}
      client={fulfillmentClient}
      onClose={onClose}
      onReconcile={onReconcile}
      selectedItems={[prize]}
    />,
  );
  return { onClose, onReconcile };
}

describe("prize fulfillment UI", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "コインに交換する" }));
    expect(await screen.findByText("手続きが完了しました")).toBeInTheDocument();
    expect(screen.getByText(`${prize.exchange_points.toLocaleString()} コインへ交換しました。`, { exact: false })).toBeInTheDocument();

    expect(exchangePrizes).toHaveBeenCalledTimes(2);
    expect(exchangePrizes.mock.calls[0]?.[1].idempotency_key).toBe(exchangePrizes.mock.calls[1]?.[1].idempotency_key);
    expect(onReconcile).toHaveBeenCalledOnce();
    expect(fulfillmentClient.listShippingAddresses).toHaveBeenCalled();
    expect(fulfillmentClient.listShippingRequests).toHaveBeenCalled();
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
  });

  it("uses typed fulfillment problems without exposing Backend detail", async () => {
    const fulfillmentClient = client({
      exchangePrizes: vi.fn().mockRejectedValue(fulfillmentProblem("PRIZE_ON_PAYMENT_HOLD", false)),
    });
    renderDialog("point_exchange", fulfillmentClient);
    fireEvent.click(screen.getByRole("button", { name: "コインに交換する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("お支払い状況の確認中");
    expect(screen.queryByText(/このdetail/)).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "発送を依頼する" }));
    expect(await screen.findByText("手続きが完了しました")).toBeInTheDocument();
    expect(fulfillmentClient.createShippingRequest).toHaveBeenCalledWith(
      address.id,
      [prize.id],
      { idempotency_key: expect.any(String) },
    );
    expect(fulfillmentClient.getShippingRequest).toHaveBeenCalledWith(shippingRequest.id);
    expect(fulfillmentClient.listShippingRequests).toHaveBeenCalled();
    expect(fulfillmentClient.listShippingAddresses).toHaveBeenCalled();
    expect(onReconcile).toHaveBeenCalledOnce();
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

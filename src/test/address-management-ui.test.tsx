import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import { vi } from "vitest";
import ShippingAddressPage from "@/app/mypage/address/page";
import { ShippingAddressManager } from "@/components/address/shipping-address-manager";
import { SessionProvider } from "@/components/auth/session-provider";
import { PrizeClientProvider } from "@/components/prizes/prize-client-provider";
import type {
  AuthClientAdapter,
  AuthSession,
  PrizeFulfillmentAdapter,
  ShippingAddress,
  ShippingAddressInput,
} from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;
const authenticated: AuthSession = {
  authenticated: true,
  user: { email_verified: true, id: "0198a001-0000-7000-8000-000000000601", state: "active" },
};
const anonymous: AuthSession = { authenticated: false, user: null };
const addressInput: ShippingAddressInput = {
  building: "サンプルビル101",
  city: "サンプル市",
  phone_number: "00000000000",
  postal_code: "0000000",
  prefecture: "サンプル県",
  recipient_name: "サンプル利用者",
  street: "サンプル町1-2-3",
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
  recipient_name_masked: "サンプル***",
  updated_at: address.updated_at,
};
const secondAddressSummary = {
  ...addressSummary,
  id: "0198a001-0000-7000-8000-000000000141",
  phone_number_masked: "***1111",
  postal_code_masked: "***1111",
  recipient_name_masked: "テスト***",
};

function response<T>(data: T) {
  return { data, metadata };
}

function authClient(session: AuthSession = authenticated): AuthClientAdapter {
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

function fulfillmentClient(overrides: Partial<PrizeFulfillmentAdapter> = {}): PrizeFulfillmentAdapter {
  return {
    createShippingAddress: vi.fn().mockResolvedValue(response(address)),
    createShippingRequest: vi.fn(),
    deleteShippingAddress: vi.fn().mockResolvedValue(response({ deleted: true as const })),
    exchangePrizes: vi.fn(),
    getPrize: vi.fn(),
    getShippingAddress: vi.fn().mockResolvedValue(response(address)),
    getShippingRequest: vi.fn(),
    listPrizes: vi.fn(),
    listShippingAddresses: vi.fn().mockResolvedValue(response({ items: [] })),
    listShippingRequests: vi.fn(),
    updateShippingAddress: vi.fn().mockResolvedValue(response(address)),
    ...overrides,
  } as PrizeFulfillmentAdapter;
}

function renderManager(client: PrizeFulfillmentAdapter, session: AuthSession = authenticated) {
  return render(
    <SessionProvider client={authClient(session)}>
      <PrizeClientProvider client={client}>
        <ShippingAddressManager />
      </PrizeClientProvider>
    </SessionProvider>,
  );
}

function fillAddress(input: ShippingAddressInput = addressInput) {
  fireEvent.change(screen.getByLabelText("お名前"), { target: { value: input.recipient_name } });
  fireEvent.change(screen.getByLabelText("郵便番号"), { target: { value: input.postal_code } });
  fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: input.prefecture } });
  fireEvent.change(screen.getByLabelText("市区町村"), { target: { value: input.city } });
  fireEvent.change(screen.getByLabelText("番地"), { target: { value: input.street } });
  fireEvent.change(screen.getByLabelText("建物名・部屋番号（任意）"), { target: { value: input.building } });
  fireEvent.change(screen.getByLabelText("電話番号"), { target: { value: input.phone_number } });
}

describe("shipping address management", () => {
  it("renders the address page title and My Page return route", async () => {
    render(
      <SessionProvider client={authClient(anonymous)}>
        <ShippingAddressPage />
      </SessionProvider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "お届け先登録" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← マイページへ戻る" })).toHaveAttribute("href", "/mypage");
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
  });

  it("requires an authenticated Session before reading addresses", async () => {
    const client = fulfillmentClient();
    renderManager(client, anonymous);
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
    expect(client.listShippingAddresses).not.toHaveBeenCalled();
  });

  it("renders loading and the canonical empty collection", async () => {
    let resolveList!: (value: ReturnType<typeof response>) => void;
    const listShippingAddresses = vi.fn(() => new Promise((resolve) => { resolveList = resolve; }));
    renderManager(fulfillmentClient({ listShippingAddresses: listShippingAddresses as PrizeFulfillmentAdapter["listShippingAddresses"] }));
    expect(await screen.findByRole("status")).toHaveTextContent("お届け先を読み込み中");
    await waitFor(() => expect(listShippingAddresses).toHaveBeenCalledOnce());
    resolveList(response({ items: [] }));
    expect(await screen.findByText("登録済みのお届け先はありません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新しいお届け先を登録" })).toBeInTheDocument();
  });

  it("renders one or multiple addresses only from masked collection fields", async () => {
    const listShippingAddresses = vi.fn().mockResolvedValue(response({ items: [addressSummary, secondAddressSummary] }));
    renderManager(fulfillmentClient({ listShippingAddresses }));
    expect(await screen.findByText("サンプル***")).toBeInTheDocument();
    expect(screen.getByText("テスト***")).toBeInTheDocument();
    expect(screen.getByText("***0000／***0000")).toBeInTheDocument();
    expect(screen.queryByText(addressInput.recipient_name)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "編集" })).toHaveLength(2);
  });

  it("creates with ShippingAddressInput, one idempotency key, and duplicate-submit prevention", async () => {
    let resolveCreate!: (value: ReturnType<typeof response<ShippingAddress>>) => void;
    const createShippingAddress = vi.fn(() => new Promise((resolve) => { resolveCreate = resolve; }));
    const listShippingAddresses = vi.fn()
      .mockResolvedValueOnce(response({ items: [] }))
      .mockResolvedValue(response({ items: [addressSummary] }));
    const client = fulfillmentClient({
      createShippingAddress: createShippingAddress as PrizeFulfillmentAdapter["createShippingAddress"],
      listShippingAddresses,
    });
    renderManager(client);
    fireEvent.click(await screen.findByRole("button", { name: "新しいお届け先を登録" }));
    fillAddress();
    const submit = screen.getByRole("button", { name: "お届け先を保存" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(createShippingAddress).toHaveBeenCalledOnce();
    expect(createShippingAddress).toHaveBeenCalledWith(addressInput, { idempotency_key: expect.any(String) });
    resolveCreate(response(address));
    expect(await screen.findByText("サンプル***")).toBeInTheDocument();
  });

  it("reuses the create idempotency key for the same retry", async () => {
    const createShippingAddress = vi.fn()
      .mockRejectedValueOnce(new StorefrontTransportError("NETWORK_ERROR", "result unknown"))
      .mockResolvedValueOnce(response(address));
    const listShippingAddresses = vi.fn()
      .mockResolvedValueOnce(response({ items: [] }))
      .mockResolvedValue(response({ items: [addressSummary] }));
    renderManager(fulfillmentClient({ createShippingAddress, listShippingAddresses }));
    fireEvent.click(await screen.findByRole("button", { name: "新しいお届け先を登録" }));
    fillAddress();
    fireEvent.click(screen.getByRole("button", { name: "お届け先を保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("通信結果を確認できませんでした");
    fireEvent.click(screen.getByRole("button", { name: "お届け先を保存" }));
    expect(await screen.findByText("サンプル***")).toBeInTheDocument();
    expect(createShippingAddress).toHaveBeenCalledTimes(2);
    expect(createShippingAddress.mock.calls[0]?.[1].idempotency_key).toBe(
      createShippingAddress.mock.calls[1]?.[1].idempotency_key,
    );
  });

  it("presents generated field validation without exposing Backend detail", async () => {
    const validation = new ApiProblemError({
      code: "INVALID_SHIPPING_ADDRESS",
      detail: "raw backend detail must stay hidden",
      errors: { postal_code: ["郵便番号の形式を確認してください。"] },
      request_id: "request-address-validation",
      retryable: false,
      status: 422,
      title: "Invalid address",
      type: "https://storefront.test/problems/invalid-shipping-address",
    });
    const client = fulfillmentClient({ createShippingAddress: vi.fn().mockRejectedValue(validation) });
    renderManager(client);
    fireEvent.click(await screen.findByRole("button", { name: "新しいお届け先を登録" }));
    fillAddress();
    fireEvent.click(screen.getByRole("button", { name: "お届け先を保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("お届け先の入力内容を確認してください");
    expect(screen.getByText("郵便番号の形式を確認してください。")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /郵便番号/ })).toHaveAttribute("aria-invalid", "true");
    expect(document.body).not.toHaveTextContent("raw backend detail");
  });

  it("updates an existing address and refreshes the canonical masked list", async () => {
    const updatedInput = { ...addressInput, city: "更新市" };
    const listShippingAddresses = vi.fn().mockResolvedValue(response({ items: [addressSummary] }));
    const updateShippingAddress = vi.fn().mockResolvedValue(response({ ...address, ...updatedInput }));
    const client = fulfillmentClient({ listShippingAddresses, updateShippingAddress });
    renderManager(client);
    fireEvent.click(await screen.findByRole("button", { name: "編集" }));
    fireEvent.change(await screen.findByLabelText("市区町村"), { target: { value: updatedInput.city } });
    fireEvent.click(screen.getByRole("button", { name: "お届け先を保存" }));
    await waitFor(() => expect(updateShippingAddress).toHaveBeenCalledWith(address.id, updatedInput));
    expect(listShippingAddresses).toHaveBeenCalledTimes(2);
  });

  it("deletes an existing address and renders the canonical empty result", async () => {
    const listShippingAddresses = vi.fn()
      .mockResolvedValueOnce(response({ items: [addressSummary] }))
      .mockResolvedValue(response({ items: [] }));
    const deleteShippingAddress = vi.fn().mockResolvedValue(response({ deleted: true as const }));
    const client = fulfillmentClient({ deleteShippingAddress, listShippingAddresses });
    renderManager(client);
    fireEvent.click(await screen.findByRole("button", { name: "削除" }));
    await waitFor(() => expect(deleteShippingAddress).toHaveBeenCalledWith(address.id));
    expect(await screen.findByText("登録済みのお届け先はありません")).toBeInTheDocument();
  });

  it("renders a typed list error and retries the canonical read", async () => {
    const problem = new ApiProblemError({
      code: "AUTHENTICATION_REQUIRED",
      detail: "private runtime detail",
      request_id: "request-address-list",
      retryable: false,
      status: 401,
      title: "Authentication required",
      type: "https://storefront.test/problems/authentication-required",
    });
    const listShippingAddresses = vi.fn()
      .mockRejectedValueOnce(problem)
      .mockResolvedValue(response({ items: [] }));
    renderManager(fulfillmentClient({ listShippingAddresses }));
    expect(await screen.findByText("お届け先を取得できませんでした")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("private runtime detail");
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(await screen.findByText("登録済みのお届け先はありません")).toBeInTheDocument();
    expect(listShippingAddresses).toHaveBeenCalledTimes(2);
  });
});

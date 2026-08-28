import { forwardRef, useEffect, useImperativeHandle } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES, PUBLIC_POINT_BALANCE_FIXTURES, PUBLIC_POINT_PRODUCT_FIXTURES } from "@oripa/storefront-testkit";
import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { PaymentClientProvider } from "@/components/payment/payment-client-provider";
import { PointClientProvider } from "@/components/points/point-client-provider";
import { PointPurchaseDetail } from "@/components/points/point-purchase-detail";
import type { AuthClientAdapter, Payment, PaymentCard, PaymentClientAdapter, PointClientAdapter } from "@/lib/platform";

const fincode = vi.hoisted(() => ({
  cleanup: vi.fn(),
  execute: vi.fn(async () => null),
  failMount: false,
  register: vi.fn(async () => "provider-card-safe-reference"),
}));

vi.mock("@/components/payment/fincode-card-fields", () => ({
  FincodeCardFields: forwardRef(function MockFincodeCardFields(
    {
      onError,
      onMountStateChange,
    }: {
      readonly onError?: (error: Error) => void;
      readonly onMountStateChange: (mounted: boolean) => void;
    },
    ref,
  ) {
    useImperativeHandle(ref, () => fincode);
    useEffect(() => {
      if (fincode.failMount) {
        onMountStateChange(false);
        onError?.(new Error("ui_mount"));
      } else {
        onMountStateChange(true);
      }
      return () => {
        fincode.cleanup();
        onMountStateChange(false);
      };
    }, [onError, onMountStateChange]);
    return <div aria-label="クレジットカード入力フォーム" data-testid="fincode-card-fields" />;
  }),
}));

const metadata = { idempotency_replayed: false, status: 200 } as const;
const product = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0];
const transferNotice = "※原則お振込みをしていただきましたら、即時コインの反映されますが、土日祝日や平日の場合でもコイン残高に反映されるまで最大で3日程度かかる場合がございます";
const konbiniUnpaidCopy = "コンビニ決済の未払いがあるため、コンビニ決済を使用できません";

function paymentProblem(code: string) {
  return new ApiProblemError({
    code,
    detail: "fixture private detail",
    request_id: "request-public-reference",
    retryable: false,
    status: 409,
    title: "fixture private title",
    type: "about:blank",
  });
}

function card(id: string, overrides: Partial<PaymentCard> = {}): PaymentCard {
  return {
    brand: "VISA",
    can_pay: true,
    expiration: { month: 12, year: 2030 },
    id,
    is_expired: false,
    last4: id.slice(-4).padStart(4, "0"),
    last_used_at: null,
    ...overrides,
  };
}

function payment(method: Payment["method"]): Payment {
  return {
    amount: product.price,
    created_at: "2026-08-26T00:00:00Z",
    expires_at: null,
    grant: { bonus_points: 100, limited_bonus_points: 300, paid_points: 1_000, total_points: 1_400 },
    id: "payment-public-reference",
    method,
    next_action: method === "credit_card"
      ? {
        access_id: "access-safe-reference",
        failure_url: "https://platform.example/failure",
        is_live_mode: false,
        payment_id: "provider-payment-safe-reference",
        public_api_key: PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox.public_api_key,
        return_url: "https://platform.example/return",
        tds_type: "2",
        type: "fincode_card_component",
      }
      : { type: "redirect", url: "https://provider.example/existing-payment" },
    point_product_id: product.id,
    status: "requires_action",
    succeeded_at: null,
  };
}

function paymentClient(cards: readonly PaymentCard[] = []): PaymentClientAdapter {
  return {
    createCardRegistrationIntent: vi.fn().mockResolvedValue({ data: {
      expires_at: "2026-08-26T01:00:00Z",
      id: "registration-intent-public-reference",
      provider_context: { customer_id: "customer-public-reference", provider: "fincode", public_api_key: PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox.public_api_key, tds_type: "2" },
    }, metadata }),
    deleteCard: vi.fn().mockResolvedValue({ data: undefined, metadata: { ...metadata, status: 204 } }),
    getPayment: vi.fn(),
    getPaymentCardUiBootstrap: vi.fn().mockResolvedValue({ data: PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox, metadata }),
    listCards: vi.fn().mockResolvedValue({ data: { data: cards, limits: { maximum: 3, remaining: 3 - cards.length } }, metadata }),
    resumeUnpaidPayment: vi.fn(),
    startPayment: vi.fn().mockImplementation((input) => Promise.resolve({ data: payment(input.payment_method), metadata: { ...metadata, status: 201 } })),
  } as PaymentClientAdapter;
}

function renderPurchase(client = paymentClient()) {
  const auth = { getCurrentSession: vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.authenticated_session, metadata }) } as unknown as AuthClientAdapter;
  const points = {
    getWallet: vi.fn().mockResolvedValue({ data: PUBLIC_POINT_BALANCE_FIXTURES.positive, metadata }),
    listPointProducts: vi.fn().mockResolvedValue({ data: { data: [product] }, metadata }),
  } as unknown as PointClientAdapter;
  render(
    <SessionProvider client={auth}>
      <PointClientProvider client={points}>
        <PaymentClientProvider client={client}>
          <PointPurchaseDetail productId={product.id} />
        </PaymentClientProvider>
      </PointClientProvider>
    </SessionProvider>,
  );
  return client;
}

async function chooseCreditCard() {
  fireEvent.click(await screen.findByRole("radio", { name: "クレジットカード" }));
  await screen.findByText(/登録カードはありません|VISA/);
}

describe("SITE-040 Payment purchase UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fincode.failMount = false;
  });

  it("shows four accessible methods in canonical order and selection beyond color", async () => {
    renderPurchase();
    const radios = await screen.findAllByRole("radio", { name: /クレジットカード|PayPay|コンビニ決済|銀行振込/ });
    expect(radios.map((radio) => radio.parentElement?.textContent)).toEqual(["クレジットカード", "PayPay", "コンビニ決済", "銀行振込"]);
    fireEvent.click(radios[1]!);
    expect(radios[1]).toBeChecked();
    expect(radios[1]?.closest(".payment-method-row")).toHaveClass("payment-method-row--selected");
    expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled();
  });

  it("shows exact Konbini and bank notices only while selected", async () => {
    renderPurchase();
    fireEvent.click(await screen.findByRole("radio", { name: "コンビニ決済" }));
    expect(screen.getByText(transferNotice)).toBeInTheDocument();
    expect(screen.queryByText(/毎月第2土曜/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "銀行振込" }));
    expect(screen.getByText(transferNotice)).toBeInTheDocument();
    expect(screen.getByText("※毎月第2土曜午後9時50分〜翌日曜午前6時は定期メンテナンスのためご利用いただけません")).toBeInTheDocument();
  });

  it("preserves card order, selects the first usable card, and leaves unusable cards deletable", async () => {
    const client = paymentClient([
      card("card-expired", { is_expired: true }),
      card("card-first"),
      card("card-disabled", { can_pay: false }),
    ]);
    renderPurchase(client);
    fireEvent.click(await screen.findByRole("radio", { name: "クレジットカード" }));
    await waitFor(() => expect(client.listCards).toHaveBeenCalledOnce());
    const saved = screen.getAllByRole("radio", { name: /VISA/ });
    expect(saved).toHaveLength(3);
    expect(saved[0]).toBeDisabled();
    expect(saved[1]).toBeChecked();
    expect(saved[2]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "削除" })).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /クレジットカードを追加/ })).not.toBeInTheDocument();
  });

  it("shows the add CTA below three cards and enables purchase only after UI mount", async () => {
    const client = paymentClient();
    renderPurchase(client);
    await chooseCreditCard();
    const purchase = screen.getByRole("button", { name: "購入する" });
    expect(purchase).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "＋クレジットカードを追加する（最大3枚まで）" }));
    expect(await screen.findByTestId("fincode-card-fields")).toBeInTheDocument();
    await waitFor(() => expect(purchase).toBeEnabled());
    expect(client.getPaymentCardUiBootstrap).toHaveBeenCalledOnce();
  });

  it("keeps purchase unavailable and presents only the safe generic error when Card UI mount fails", async () => {
    fincode.failMount = true;
    renderPurchase();
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("エラーが発生しました。時間をおいて、もう一度お試しください。");
    expect(screen.getByRole("alert")).not.toHaveTextContent("ui_mount");
    expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled();
  });

  it("cleans the mounted Card UI when the payment method changes", async () => {
    renderPurchase();
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("radio", { name: "PayPay" }));
    expect(fincode.cleanup).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("fincode-card-fields")).not.toBeInTheDocument();
  });

  it("fails closed when card inventory is unknown and allows an explicit retry", async () => {
    const client = paymentClient();
    vi.mocked(client.listCards)
      .mockRejectedValueOnce(new Error("fixture card read failure"))
      .mockResolvedValueOnce({ data: { data: [], limits: { maximum: 3, remaining: 3 } }, metadata });
    renderPurchase(client);
    fireEvent.click(await screen.findByRole("radio", { name: "クレジットカード" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /クレジットカードを追加/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "登録カードを再読み込みする" }));
    expect(await screen.findByRole("button", { name: /クレジットカードを追加/ })).toBeEnabled();
    expect(client.listCards).toHaveBeenCalledTimes(2);
  });

  it("starts a saved-card Payment with only the canonical public card id", async () => {
    const client = paymentClient([card("card-public-4242")]);
    renderPurchase(client);
    fireEvent.click(await screen.findByRole("radio", { name: "クレジットカード" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /VISA/ })).toBeChecked());
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledOnce());
    expect(client.startPayment).toHaveBeenCalledWith({
      card: { card_id: "card-public-4242", source: "saved" },
      payment_method: "credit_card",
      point_product_id: product.id,
    }, expect.objectContaining({ idempotency_key: expect.any(String) }));
  });

  it.each([
    ["PayPay", "paypay"],
    ["コンビニ決済", "konbini"],
    ["銀行振込", "virtual_account"],
  ] as const)("starts %s through the canonical client without resume or replacement creation", async (label, method) => {
    const client = paymentClient();
    renderPurchase(client);
    fireEvent.click(await screen.findByRole("radio", { name: label }));
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledOnce());
    expect(client.startPayment).toHaveBeenCalledWith(
      { payment_method: method, point_product_id: product.id },
      expect.objectContaining({ idempotency_key: expect.any(String) }),
    );
    expect(client.resumeUnpaidPayment).not.toHaveBeenCalled();
  });

  it("shows the exact unpaid-limit copy for only a canonical Konbini start failure", async () => {
    const client = paymentClient();
    vi.mocked(client.startPayment).mockRejectedValueOnce(paymentProblem("KONBINI_UNPAID_LIMIT_REACHED"));
    renderPurchase(client);
    fireEvent.click(await screen.findByRole("radio", { name: "コンビニ決済" }));
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(konbiniUnpaidCopy);
  });

  it("keeps another Konbini ApiProblem on the generic Payment copy", async () => {
    const client = paymentClient();
    vi.mocked(client.startPayment).mockRejectedValueOnce(paymentProblem("OTHER_PAYMENT_ERROR"));
    renderPurchase(client);
    fireEvent.click(await screen.findByRole("radio", { name: "コンビニ決済" }));
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("決済処理を完了できませんでした。時間をおいて、もう一度お試しください。");
    expect(alert).not.toHaveTextContent(konbiniUnpaidCopy);
  });

  it.each([
    ["クレジットカード", "credit_card"],
    ["PayPay", "paypay"],
    ["銀行振込", "virtual_account"],
  ] as const)("does not apply the Konbini copy to %s", async (label, method) => {
    const client = paymentClient(method === "credit_card" ? [card("card-public-4242")] : []);
    vi.mocked(client.startPayment).mockRejectedValueOnce(paymentProblem("KONBINI_UNPAID_LIMIT_REACHED"));
    renderPurchase(client);
    fireEvent.click(await screen.findByRole("radio", { name: label }));
    if (method === "credit_card") await waitFor(() => expect(screen.getByRole("radio", { name: /VISA/ })).toBeChecked());
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("決済処理を完了できませんでした。時間をおいて、もう一度お試しください。");
    expect(alert).not.toHaveTextContent(konbiniUnpaidCopy);
  });

  it("keeps a Konbini Transport Error on the result-unknown copy", async () => {
    const client = paymentClient();
    vi.mocked(client.startPayment).mockRejectedValueOnce(new StorefrontTransportError("NETWORK_ERROR", "fixture network failure"));
    renderPurchase(client);
    fireEvent.click(await screen.findByRole("radio", { name: "コンビニ決済" }));
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("通信結果を確認できませんでした。同じ操作を繰り返さず、時間をおいて状態をご確認ください。");
    expect(alert).not.toHaveTextContent(konbiniUnpaidCopy);
  });

  it("starts one-time new-card payment without registration completion", async () => {
    const client = paymentClient();
    renderPurchase(client);
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledOnce());
    expect(client.startPayment).toHaveBeenCalledWith(
      { card: { save: false, source: "new" }, payment_method: "credit_card", point_product_id: product.id },
      expect.objectContaining({ idempotency_key: expect.any(String) }),
    );
    expect(client.createCardRegistrationIntent).not.toHaveBeenCalled();
    expect(fincode.execute).toHaveBeenCalled();
  });

  it("uses intent and provider card reference for save, with the same idempotency key", async () => {
    const client = paymentClient();
    renderPurchase(client);
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    const save = await screen.findByRole("checkbox", { name: "このカードを保存する" });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledOnce());
    const intentOptions = vi.mocked(client.createCardRegistrationIntent).mock.calls[0]?.[0];
    const startOptions = vi.mocked(client.startPayment).mock.calls[0]?.[1];
    expect(intentOptions?.idempotency_key).toBe(startOptions?.idempotency_key);
    expect(client.startPayment).toHaveBeenCalledWith(expect.objectContaining({ card: {
      provider_card_id: "provider-card-safe-reference",
      registration_intent_id: "registration-intent-public-reference",
      save: true,
      source: "new",
    } }), expect.anything());
    expect(fincode.register).toHaveBeenCalledOnce();
    expect(Object.keys(client)).not.toContain("completeCardRegistration");
  });

  it("fails closed on fincode environment skew after Payment creation", async () => {
    const client = paymentClient();
    const skewed = payment("credit_card");
    if (skewed.next_action?.type === "fincode_card_component") skewed.next_action.is_live_mode = true;
    vi.mocked(client.startPayment).mockResolvedValueOnce({ data: skewed, metadata: { ...metadata, status: 201 } });
    renderPurchase(client);
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    expect(await screen.findByText("決済状況を確認できるまで、新しい決済は開始できません。")).toBeInTheDocument();
    expect(fincode.execute).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled();
  });

  it("gives an immediate canonical terminal status priority over a new-card Provider action", async () => {
    const client = paymentClient();
    vi.mocked(client.startPayment).mockResolvedValueOnce({
      data: { ...payment("credit_card"), next_action: null, status: "succeeded", succeeded_at: "2026-08-26T00:00:01Z" },
      metadata: { ...metadata, status: 201 },
    });
    renderPurchase(client);
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledOnce());
    expect(fincode.execute).not.toHaveBeenCalled();
  });

  it("prevents double submit while Payment creation is pending", async () => {
    const client = paymentClient();
    vi.mocked(client.startPayment).mockImplementation(() => new Promise(() => undefined));
    renderPurchase(client);
    const paypay = await screen.findByRole("radio", { name: "PayPay" });
    fireEvent.click(paypay);
    const button = screen.getByRole("button", { name: "購入する" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "処理中…" })).toBeDisabled();
  });

  it("refreshes after delete and presents deletion failures", async () => {
    const client = paymentClient([card("card-delete")]);
    vi.mocked(client.deleteCard).mockRejectedValueOnce(new Error("fixture delete failure"));
    renderPurchase(client);
    fireEvent.click(await screen.findByRole("radio", { name: "クレジットカード" }));
    const cardGroup = await screen.findByRole("group", { name: "登録カード" });
    fireEvent.click(within(cardGroup).getByRole("button", { name: "削除" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("エラーが発生しました。時間をおいて、もう一度お試しください。");
  });

  it("refreshes the canonical card collection after successful deletion", async () => {
    const client = paymentClient([card("card-delete")]);
    vi.mocked(client.listCards)
      .mockResolvedValueOnce({ data: { data: [card("card-delete")], limits: { maximum: 3, remaining: 2 } }, metadata })
      .mockResolvedValueOnce({ data: { data: [], limits: { maximum: 3, remaining: 3 } }, metadata });
    renderPurchase(client);
    fireEvent.click(await screen.findByRole("radio", { name: "クレジットカード" }));
    fireEvent.click(await screen.findByRole("button", { name: "削除" }));
    expect(await screen.findByText("登録カードはありません。")).toBeInTheDocument();
    expect(client.deleteCard).toHaveBeenCalledWith("card-delete");
    expect(client.listCards).toHaveBeenCalledTimes(2);
  });
});

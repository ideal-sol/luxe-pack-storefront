import { readFileSync } from "node:fs";
import { forwardRef, StrictMode, useEffect, useImperativeHandle } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_PAYMENT_CARD_CAPACITY_FIXTURES,
  PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES,
  PUBLIC_PAYMENT_CARD_REGISTRATION_PROBLEM_FIXTURES,
  PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES,
  PUBLIC_POINT_BALANCE_FIXTURES,
  PUBLIC_POINT_PRODUCT_FIXTURES,
} from "@oripa/storefront-testkit";
import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { PaymentClientProvider } from "@/components/payment/payment-client-provider";
import { saveCardRegistrationResume } from "@/components/payment/card-registration-resume";
import { PointClientProvider } from "@/components/points/point-client-provider";
import { PointPurchaseDetail } from "@/components/points/point-purchase-detail";
import type { AuthClientAdapter, Payment, PaymentCard, PaymentCardCollection, PaymentClientAdapter, PointClientAdapter } from "@/lib/platform";

const fincode = vi.hoisted(() => ({
  cleanup: vi.fn(),
  execute: vi.fn(async () => null),
  failMount: false,
  tokenize: vi.fn(async () => "tok_browser_public-safe-fixture"),
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
const registrationPaymentIdempotencyKey = "0198a001-0000-7000-8000-000000009803";

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

function registrationProblem(
  fixture: (typeof PUBLIC_PAYMENT_CARD_REGISTRATION_PROBLEM_FIXTURES)[keyof typeof PUBLIC_PAYMENT_CARD_REGISTRATION_PROBLEM_FIXTURES],
) {
  return new ApiProblemError({
    ...fixture,
    detail: "provider raw private detail must not be displayed",
    title: "provider raw private title must not be displayed",
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
    verification_status: "verified",
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

function paymentClient(
  cards: readonly PaymentCard[] = [],
  limits: PaymentCardCollection["limits"] = {
    maximum: 3,
    next_capacity_at: null,
    registration_remaining: 3 - cards.length,
    remaining: 3 - cards.length,
  },
): PaymentClientAdapter {
  return {
    cancelCardRegistration: vi.fn(),
    deleteCard: vi.fn().mockResolvedValue({ data: undefined, metadata: { ...metadata, status: 204 } }),
    getCardRegistration: vi.fn().mockResolvedValue({ data: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.completed, metadata }),
    getPayment: vi.fn(),
    getPaymentCardUiBootstrap: vi.fn().mockResolvedValue({ data: PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox, metadata }),
    listCards: vi.fn().mockResolvedValue({ data: { data: cards, limits }, metadata }),
    reconcileCardRegistration: vi.fn().mockResolvedValue({ data: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.completed, metadata }),
    resumeUnpaidPayment: vi.fn(),
    startCardRegistration: vi.fn().mockResolvedValue({ data: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.requires_action, metadata: { ...metadata, status: 201 } }),
    startPayment: vi.fn().mockImplementation((input) => Promise.resolve({ data: payment(input.payment_method), metadata: { ...metadata, status: 201 } })),
  } as unknown as PaymentClientAdapter;
}

function renderPurchase(
  client = paymentClient(),
  registrationId: string | null = null,
  strict = false,
) {
  const auth = { getCurrentSession: vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.authenticated_session, metadata }) } as unknown as AuthClientAdapter;
  const points = {
    getWallet: vi.fn().mockResolvedValue({ data: PUBLIC_POINT_BALANCE_FIXTURES.positive, metadata }),
    listPointProducts: vi.fn().mockResolvedValue({ data: { data: [product] }, metadata }),
  } as unknown as PointClientAdapter;
  const view = (
    <SessionProvider client={auth}>
      <PointClientProvider client={points}>
        <PaymentClientProvider client={client}>
          <PointPurchaseDetail productId={product.id} registrationId={registrationId} />
        </PaymentClientProvider>
      </PointClientProvider>
    </SessionProvider>
  );
  render(strict ? <StrictMode>{view}</StrictMode> : view);
  return client;
}

async function chooseCreditCard() {
  fireEvent.click(await screen.findByRole("radio", { name: "クレジットカード" }));
  await screen.findByText(/登録カードはありません|VISA/);
}

describe("SITE-040 / SITE-048 Payment purchase UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fincode.failMount = false;
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
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
    const firstFields = screen.getByTestId("fincode-card-fields");
    fireEvent.click(screen.getByRole("radio", { name: "PayPay" }));
    expect(fincode.cleanup).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("fincode-card-fields")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "クレジットカード" }));
    expect(await screen.findByTestId("fincode-card-fields")).not.toBe(firstFields);
  });

  it("uses registration_remaining instead of cards.length and presents next_capacity_at", async () => {
    const capacity = PUBLIC_PAYMENT_CARD_CAPACITY_FIXTURES.saved_2_pending_1;
    const client = paymentClient(capacity.data, capacity.limits);
    renderPurchase(client);
    fireEvent.click(await screen.findByRole("radio", { name: "クレジットカード" }));
    expect(await screen.findByRole("button", { name: /クレジットカードを追加/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    const dialog = screen.getByRole("dialog", { name: "このカードを保存しますか？" });
    expect(within(dialog).getByRole("button", { name: "カードを保存して購入" })).toBeDisabled();
    expect(within(dialog).getByText(/2026/)).toHaveTextContent(/カードの保存は.*以降に再度お試しください。/);
    fireEvent.click(within(dialog).getByRole("button", { name: "保存せず購入" }));
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledOnce());
    expect(client.startCardRegistration).not.toHaveBeenCalled();
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
    vi.mocked(client.startPayment).mockResolvedValueOnce({
      data: { ...payment("credit_card"), next_action: { type: "three_d_secure", url: "https://provider.example/saved-card-3ds" } },
      metadata: { ...metadata, status: 201 },
    });
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
    expect(fincode.execute).not.toHaveBeenCalled();
    expect(readFileSync("src/components/points/point-purchase-detail.tsx", "utf8"))
      .toContain("window.location.assign(payment.next_action.url)");
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

  it("opens the canonical save confirmation and Back retains the mounted Card input without mutation", async () => {
    const client = paymentClient();
    renderPurchase(client);
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
    const fields = screen.getByTestId("fincode-card-fields");
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    const dialog = screen.getByRole("dialog", { name: "このカードを保存しますか？" });
    expect(within(dialog).getByText("カードを保存すると、次回以降はカード情報の入力を省略できます。")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "戻る" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("fincode-card-fields")).toBe(fields);
    expect(fincode.cleanup).not.toHaveBeenCalled();
    expect(client.startCardRegistration).not.toHaveBeenCalled();
    expect(client.startPayment).not.toHaveBeenCalled();
  });

  it("starts one-time new-card Payment from 保存せず購入 with Registration zero", async () => {
    const client = paymentClient();
    renderPurchase(client);
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    fireEvent.click(screen.getByRole("button", { name: "保存せず購入" }));
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledOnce());
    expect(client.startPayment).toHaveBeenCalledWith(
      { card: { save: false, source: "new" }, payment_method: "credit_card", point_product_id: product.id },
      expect.objectContaining({ idempotency_key: expect.any(String) }),
    );
    expect(client.startCardRegistration).not.toHaveBeenCalled();
    expect(fincode.execute).toHaveBeenCalledWith(expect.objectContaining({
      failure_url: "https://platform.example/failure",
      return_url: "https://platform.example/return",
      type: "fincode_card_component",
    }));
  });

  it("uses completed Registration saved_card_id for a separate Payment 3DS start", async () => {
    const client = paymentClient();
    vi.mocked(client.startCardRegistration).mockResolvedValueOnce({
      data: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.completed,
      metadata: { ...metadata, status: 201 },
    });
    vi.mocked(client.startPayment).mockResolvedValueOnce({
      data: { ...payment("credit_card"), next_action: { type: "three_d_secure", url: "https://provider.example/save-and-pay-3ds" } },
      metadata: { ...metadata, status: 201 },
    });
    renderPurchase(client);
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    fireEvent.click(screen.getByRole("button", { name: "カードを保存して購入" }));
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledOnce());
    expect(client.startCardRegistration).toHaveBeenCalledWith(
      { card_token: "tok_browser_public-safe-fixture" },
      expect.objectContaining({ idempotency_key: expect.any(String) }),
    );
    expect(client.startPayment).toHaveBeenCalledWith({
      card: { card_id: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.completed.saved_card_id, source: "saved" },
      payment_method: "credit_card",
      point_product_id: product.id,
    }, expect.objectContaining({ idempotency_key: expect.any(String) }));
    expect(fincode.tokenize).toHaveBeenCalledOnce();
    expect(fincode.execute).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("luxe-pack:card-registration-resume:v1")).toBeNull();
    const source = readFileSync("src/components/points/point-purchase-detail.tsx", "utf8");
    expect(source).not.toMatch(/createCardRegistrationIntent|provider_card_id|registration_intent_id/);
    expect(readFileSync("src/components/payment/fincode-card-fields.tsx", "utf8")).not.toContain("registerCard");
  });

  it("retries a definitive post-Registration Payment failure from the saved Card without duplicate Registration", async () => {
    const registration = PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.completed;
    const savedCard = card(registration.saved_card_id);
    const client = paymentClient();
    vi.mocked(client.listCards)
      .mockResolvedValueOnce({
        data: PUBLIC_PAYMENT_CARD_CAPACITY_FIXTURES.saved_0_pending_0,
        metadata,
      })
      .mockResolvedValue({
        data: {
          data: [savedCard],
          limits: { maximum: 3, next_capacity_at: null, registration_remaining: 2, remaining: 2 },
        },
        metadata,
      });
    vi.mocked(client.startCardRegistration).mockResolvedValueOnce({
      data: registration,
      metadata: { ...metadata, status: 201 },
    });
    vi.mocked(client.startPayment)
      .mockRejectedValueOnce(paymentProblem("PAYMENT_FAILED"))
      .mockResolvedValueOnce({
        data: { ...payment("credit_card"), next_action: { type: "three_d_secure", url: "https://provider.example/saved-card-retry-3ds" } },
        metadata: { ...metadata, status: 201 },
      });
    renderPurchase(client);
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    fireEvent.click(screen.getByRole("button", { name: "カードを保存して購入" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("決済処理を完了できませんでした。時間をおいて、もう一度お試しください。");
    await waitFor(() => expect(screen.getByRole("radio", { name: /VISA/ })).toBeChecked());
    expect(screen.queryByTestId("fincode-card-fields")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledTimes(2));
    expect(client.startCardRegistration).toHaveBeenCalledOnce();
    expect(fincode.tokenize).toHaveBeenCalledOnce();
    expect(client.startPayment).toHaveBeenLastCalledWith({
      card: { card_id: registration.saved_card_id, source: "saved" },
      payment_method: "credit_card",
      point_product_id: product.id,
    }, expect.objectContaining({ idempotency_key: expect.any(String) }));
  });

  it("stores only opaque resume context for Registration next_action and does not start Payment", async () => {
    const client = paymentClient();
    renderPurchase(client);
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    fireEvent.click(screen.getByRole("button", { name: "カードを保存して購入" }));
    await waitFor(() => expect(client.startCardRegistration).toHaveBeenCalledOnce());
    expect(client.startPayment).not.toHaveBeenCalled();
    const stored = window.sessionStorage.getItem("luxe-pack:card-registration-resume:v1");
    expect(stored).toContain(PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.requires_action.id);
    expect(stored).toContain(product.id);
    expect(stored).not.toContain("tok_browser_public-safe-fixture");
    expect(stored).not.toMatch(/cardNo|CVC|security_code/);
  });

  it("requires canonical completed read before starting Payment after Browser Return", async () => {
    const registration = PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.completed;
    saveCardRegistrationResume({
      paymentIdempotencyKey: registrationPaymentIdempotencyKey,
      productId: product.id,
      registrationId: registration.id,
    });
    const client = paymentClient();
    vi.mocked(client.getCardRegistration).mockResolvedValueOnce({ data: registration, metadata });
    vi.mocked(client.startPayment).mockResolvedValueOnce({
      data: { ...payment("credit_card"), next_action: { type: "three_d_secure", url: "https://provider.example/return-payment-3ds" } },
      metadata: { ...metadata, status: 201 },
    });
    renderPurchase(client, registration.id, true);
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledOnce());
    expect(client.getCardRegistration).toHaveBeenCalledWith(registration.id);
    expect(client.reconcileCardRegistration).not.toHaveBeenCalled();
    expect(client.startPayment).toHaveBeenCalledWith({
      card: { card_id: registration.saved_card_id, source: "saved" },
      payment_method: "credit_card",
      point_product_id: product.id,
    }, { idempotency_key: registrationPaymentIdempotencyKey });
    expect(client.startCardRegistration).not.toHaveBeenCalled();
    expect(fincode.tokenize).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("luxe-pack:card-registration-resume:v1")).toBeNull();
  });

  it("performs one typed reconcile for an incomplete Return and then uses only saved_card_id", async () => {
    const registration = PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.requires_action;
    saveCardRegistrationResume({
      paymentIdempotencyKey: registrationPaymentIdempotencyKey,
      productId: product.id,
      registrationId: registration.id,
    });
    const client = paymentClient();
    vi.mocked(client.getCardRegistration).mockResolvedValueOnce({
      data: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.pending,
      metadata,
    });
    vi.mocked(client.reconcileCardRegistration).mockResolvedValueOnce({
      data: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.completed,
      metadata,
    });
    vi.mocked(client.startPayment).mockResolvedValueOnce({
      data: { ...payment("credit_card"), next_action: { type: "three_d_secure", url: "https://provider.example/reconciled-payment-3ds" } },
      metadata: { ...metadata, status: 201 },
    });
    renderPurchase(client, registration.id);
    await waitFor(() => expect(client.startPayment).toHaveBeenCalledOnce());
    expect(client.getCardRegistration).toHaveBeenCalledOnce();
    expect(client.reconcileCardRegistration).toHaveBeenCalledOnce();
    expect(client.startPayment).toHaveBeenCalledWith(expect.objectContaining({
      card: {
        card_id: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.completed.saved_card_id,
        source: "saved",
      },
    }), { idempotency_key: registrationPaymentIdempotencyKey });
  });

  it.each(["failed", "canceled", "expired"] as const)(
    "returns %s Registration to Purchase without Payment, Thanks, or automatic retry",
    async (status) => {
      const registration = PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES[status];
      saveCardRegistrationResume({
        paymentIdempotencyKey: registrationPaymentIdempotencyKey,
        productId: product.id,
        registrationId: registration.id,
      });
      const client = paymentClient();
      vi.mocked(client.getCardRegistration).mockResolvedValueOnce({ data: registration, metadata });
      renderPurchase(client, registration.id);
      expect(await screen.findByRole("alert")).toHaveTextContent("エラーが発生しました。時間をおいて、もう一度お試しください。");
      expect(client.getCardRegistration).toHaveBeenCalledOnce();
      expect(client.reconcileCardRegistration).not.toHaveBeenCalled();
      expect(client.startPayment).not.toHaveBeenCalled();
      expect(client.startCardRegistration).not.toHaveBeenCalled();
      expect(window.location.pathname).not.toBe("/points/purchase/thanks");
      expect(window.sessionStorage.getItem("luxe-pack:card-registration-resume:v1")).toBeNull();
    },
  );

  it("fails closed after one reconcile when Registration remains incomplete", async () => {
    const registration = PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.requires_action;
    saveCardRegistrationResume({
      paymentIdempotencyKey: registrationPaymentIdempotencyKey,
      productId: product.id,
      registrationId: registration.id,
    });
    const client = paymentClient();
    vi.mocked(client.getCardRegistration).mockResolvedValueOnce({ data: registration, metadata });
    vi.mocked(client.reconcileCardRegistration).mockResolvedValueOnce({ data: registration, metadata });
    renderPurchase(client, registration.id);
    expect(await screen.findByText("決済状況を確認できるまで、新しい決済は開始できません。")).toBeInTheDocument();
    expect(client.getCardRegistration).toHaveBeenCalledOnce();
    expect(client.reconcileCardRegistration).toHaveBeenCalledOnce();
    expect(client.startPayment).not.toHaveBeenCalled();
    expect(client.startCardRegistration).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("luxe-pack:card-registration-resume:v1")).toContain("return_processing");
  });

  it("keeps a typed unavailable Return uncertain after one reconcile with Payment zero", async () => {
    const registration = PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.pending;
    saveCardRegistrationResume({
      paymentIdempotencyKey: registrationPaymentIdempotencyKey,
      productId: product.id,
      registrationId: registration.id,
    });
    const client = paymentClient();
    vi.mocked(client.getCardRegistration).mockResolvedValueOnce({ data: registration, metadata });
    vi.mocked(client.reconcileCardRegistration).mockRejectedValueOnce(
      registrationProblem(PUBLIC_PAYMENT_CARD_REGISTRATION_PROBLEM_FIXTURES.unavailable),
    );
    renderPurchase(client, registration.id);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("通信結果を確認できませんでした。同じ操作を繰り返さず、時間をおいて状態をご確認ください。");
    expect(alert).not.toHaveTextContent(/provider raw private/);
    expect(client.getCardRegistration).toHaveBeenCalledOnce();
    expect(client.reconcileCardRegistration).toHaveBeenCalledOnce();
    expect(client.startPayment).not.toHaveBeenCalled();
    expect(client.startCardRegistration).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("luxe-pack:card-registration-resume:v1")).toContain("return_processing");
  });

  it("does not accept Browser Return without matching opaque correlation", async () => {
    const client = paymentClient();
    renderPurchase(client, PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.completed.id);
    expect(await screen.findByText("決済状況を確認できるまで、新しい決済は開始できません。")).toBeInTheDocument();
    expect(client.getCardRegistration).not.toHaveBeenCalled();
    expect(client.reconcileCardRegistration).not.toHaveBeenCalled();
    expect(client.startPayment).not.toHaveBeenCalled();
  });

  it("locks an interrupted Registration correlation instead of allowing another submit", async () => {
    const registration = PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.requires_action;
    saveCardRegistrationResume({
      paymentIdempotencyKey: registrationPaymentIdempotencyKey,
      productId: product.id,
      registrationId: registration.id,
    });
    const client = paymentClient();
    renderPurchase(client);
    expect(await screen.findByText("決済状況を確認できるまで、新しい決済は開始できません。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled();
    expect(client.startCardRegistration).not.toHaveBeenCalled();
    expect(client.startPayment).not.toHaveBeenCalled();
  });

  it("keeps typed unavailable raw detail private and starts neither Payment nor automatic Registration retry", async () => {
    const client = paymentClient();
    vi.mocked(client.startCardRegistration).mockRejectedValueOnce(
      registrationProblem(PUBLIC_PAYMENT_CARD_REGISTRATION_PROBLEM_FIXTURES.unavailable),
    );
    renderPurchase(client);
    await chooseCreditCard();
    fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "購入する" }));
    fireEvent.click(screen.getByRole("button", { name: "カードを保存して購入" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("通信結果を確認できませんでした。同じ操作を繰り返さず、時間をおいて状態をご確認ください。");
    expect(alert).not.toHaveTextContent(/provider raw private/);
    expect(client.startCardRegistration).toHaveBeenCalledOnce();
    expect(client.startPayment).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled();
  });

  it.each(["failed", "canceled", "expired"] as const)(
    "starts no Payment when Registration start returns canonical %s",
    async (status) => {
      const client = paymentClient();
      vi.mocked(client.startCardRegistration).mockResolvedValueOnce({
        data: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES[status],
        metadata: { ...metadata, status: 201 },
      });
      renderPurchase(client);
      await chooseCreditCard();
      fireEvent.click(screen.getByRole("button", { name: /クレジットカードを追加/ }));
      await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: "購入する" }));
      fireEvent.click(screen.getByRole("button", { name: "カードを保存して購入" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("エラーが発生しました。時間をおいて、もう一度お試しください。");
      expect(client.startCardRegistration).toHaveBeenCalledOnce();
      expect(client.startPayment).not.toHaveBeenCalled();
      expect(window.location.pathname).not.toBe("/points/purchase/thanks");
    },
  );

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
    fireEvent.click(screen.getByRole("button", { name: "保存せず購入" }));
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
    fireEvent.click(screen.getByRole("button", { name: "保存せず購入" }));
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

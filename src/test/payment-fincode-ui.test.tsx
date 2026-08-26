import { readFileSync } from "node:fs";
import { createRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { FincodeCardFields, type FincodeCardFieldsHandle } from "@/components/payment/fincode-card-fields";
import type { PaymentCardComponentAction, PaymentCardRegistrationIntent } from "@/lib/platform";

const provider = vi.hoisted(() => {
  const create = vi.fn();
  const mount = vi.fn((id: string) => {
    document.getElementById(id)?.append(document.createElement("iframe"));
  });
  const ui = { create, mount };
  const fincode = { ui: vi.fn(() => ui) };
  return {
    create,
    executePayment: vi.fn(async () => ({ redirect_url: "https://provider.example/3ds" })),
    fincode,
    initFincode: vi.fn(async () => fincode),
    mount,
    registerCard: vi.fn(async () => ({ id: "provider-card-safe-reference" })),
    ui,
  };
});

vi.mock("@fincode/js", () => ({
  executePayment: provider.executePayment,
  initFincode: provider.initFincode,
  registerCard: provider.registerCard,
}));

const action = {
  access_id: "access-safe-reference",
  failure_url: "https://platform.example/payment/failure",
  is_live_mode: false,
  payment_id: "provider-payment-safe-reference",
  public_api_key: "p_test_public-safe-fixture",
  return_url: "https://platform.example/payment/return",
  tds_type: "2",
  type: "fincode_card_component",
} satisfies PaymentCardComponentAction;

const intent = {
  expires_at: "2026-08-26T01:00:00Z",
  id: "registration-intent-public-reference",
  provider_context: {
    customer_id: "customer-public-reference",
    provider: "fincode",
    public_api_key: "p_test_public-safe-fixture",
    tds_type: "2",
  },
} satisfies PaymentCardRegistrationIntent;

describe("SITE-040 fincode Card UI boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    provider.initFincode.mockResolvedValue(provider.fincode);
  });

  it("initializes the canonical environment, creates, and mounts the Payment component", async () => {
    const states: boolean[] = [];
    render(<FincodeCardFields bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox} onMountStateChange={(state) => states.push(state)} />);
    await waitFor(() => expect(provider.mount).toHaveBeenCalledOnce());
    expect(provider.initFincode).toHaveBeenCalledWith({ isLiveMode: false, publicKey: "p_test_public-safe-fixture" });
    expect(provider.create).toHaveBeenCalledWith("payments", expect.objectContaining({
      hidePayTimes: true,
      labelCVC: "セキュリティコード",
      labelCardNo: "カード番号",
      labelExpire: "有効期限",
      labelHolderName: "カード名義人",
    }));
    expect(states.at(-1)).toBe(true);
    expect(screen.getByLabelText("クレジットカード入力フォーム").querySelector("iframe")).toBeInTheDocument();
  });

  it("delegates one-time execution and saved-card registration without exposing raw fields", async () => {
    const ref = createRef<FincodeCardFieldsHandle>();
    render(<FincodeCardFields bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox} onMountStateChange={() => undefined} ref={ref} />);
    await waitFor(() => expect(ref.current).not.toBeNull());
    await waitFor(() => expect(provider.mount).toHaveBeenCalled());
    await expect(ref.current!.execute(action)).resolves.toBe("https://provider.example/3ds");
    await expect(ref.current!.register(intent)).resolves.toBe("provider-card-safe-reference");
    expect(provider.executePayment).toHaveBeenCalledWith(expect.objectContaining({ accessId: action.access_id, id: action.payment_id, payType: "Card", ui: provider.ui }));
    expect(provider.registerCard).toHaveBeenCalledWith(expect.objectContaining({ customerId: intent.provider_context.customer_id, useDefault: false, ui: provider.ui }));
    const source = readFileSync("src/components/payment/fincode-card-fields.tsx", "utf8");
    expect(source).not.toMatch(/getFormData|addEventListener|localStorage|sessionStorage/);
    expect(source).not.toMatch(/\bpan\b|card_number|security_code/i);
  });

  it("clears the provider mount and reports not-mounted on unmount", async () => {
    const states: boolean[] = [];
    const view = render(<FincodeCardFields bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox} onMountStateChange={(state) => states.push(state)} />);
    await waitFor(() => expect(states.at(-1)).toBe(true));
    act(() => view.unmount());
    expect(states.at(-1)).toBe(false);
    expect(document.querySelector(".fincode-card-fields")).not.toBeInTheDocument();
  });

  it("never reports mounted when canonical SDK initialization fails", async () => {
    const states: boolean[] = [];
    provider.initFincode.mockRejectedValueOnce(new Error("fixture SDK failure"));
    render(<FincodeCardFields bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox} onMountStateChange={(state) => states.push(state)} />);
    await waitFor(() => expect(provider.initFincode).toHaveBeenCalledOnce());
    await act(async () => { await Promise.resolve(); });
    expect(states).not.toContain(true);
    expect(provider.mount).not.toHaveBeenCalled();
  });
});

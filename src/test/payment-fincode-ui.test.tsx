import { readFileSync } from "node:fs";
import { createRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import {
  FincodeCardFields,
  type FincodeCardFieldsHandle,
  type FincodeCardUiError,
} from "@/components/payment/fincode-card-fields";
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

function setProviderInitializer(value: unknown) {
  Object.defineProperty(window, "Fincode", { configurable: true, value, writable: true });
}

function providerScripts() {
  return Array.from(document.scripts).filter((script) =>
    ["https://js.test.fincode.jp/v1/fincode.js", "https://js.fincode.jp/v1/fincode.js"].includes(script.src),
  );
}

describe("SITE-043 fincode Card UI boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    provider.create.mockImplementation(() => undefined);
    provider.fincode.ui.mockImplementation(() => provider.ui);
    provider.initFincode.mockResolvedValue(provider.fincode);
    provider.mount.mockImplementation((id: string) => {
      document.getElementById(id)?.append(document.createElement("iframe"));
    });
    providerScripts().forEach((script) => script.remove());
    setProviderInitializer(vi.fn());
  });

  it("loads the official Browser SDK, initializes, creates, and mounts the Payment component", async () => {
    const errors: FincodeCardUiError[] = [];
    const states: boolean[] = [];
    setProviderInitializer(undefined);
    render(
      <FincodeCardFields
        bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox}
        onError={(error) => errors.push(error)}
        onMountStateChange={(state) => states.push(state)}
      />,
    );
    const script = await waitFor(() => {
      const candidate = providerScripts()[0];
      expect(candidate).toBeDefined();
      return candidate!;
    });
    expect(script.src).toBe("https://js.test.fincode.jp/v1/fincode.js");
    expect(script.async).toBe(true);
    setProviderInitializer(vi.fn());
    act(() => script.dispatchEvent(new Event("load")));
    await waitFor(() => expect(provider.mount).toHaveBeenCalledOnce());
    expect(provider.initFincode).toHaveBeenCalledWith({ isLiveMode: false, publicKey: "p_test_public-safe-fixture" });
    expect(provider.create).toHaveBeenCalledWith("payments", expect.objectContaining({
      hidePayTimes: true,
      labelCVC: "セキュリティコード",
      labelCardNo: "カード番号",
      labelExpire: "有効期限",
      labelHolderName: "カード名義人",
    }));
    expect(errors).toEqual([]);
    expect(states.at(-1)).toBe(true);
    expect(screen.getByLabelText("クレジットカード入力フォーム").querySelector("iframe")).toBeInTheDocument();
  });

  it("classifies an official SDK resource failure without attempting initialization", async () => {
    const errors: FincodeCardUiError[] = [];
    const states: boolean[] = [];
    setProviderInitializer(undefined);
    render(
      <FincodeCardFields
        bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox}
        onError={(error) => errors.push(error)}
        onMountStateChange={(state) => states.push(state)}
      />,
    );
    const script = await waitFor(() => {
      const candidate = providerScripts()[0];
      expect(candidate).toBeDefined();
      return candidate!;
    });
    act(() => script.dispatchEvent(new Event("error")));
    await waitFor(() => expect(errors.at(-1)?.stage).toBe("sdk_load"));
    expect(states).not.toContain(true);
    expect(provider.initFincode).not.toHaveBeenCalled();
  });

  it("classifies init failure and keeps the Card UI unavailable", async () => {
    const errors: FincodeCardUiError[] = [];
    const states: boolean[] = [];
    provider.initFincode.mockRejectedValueOnce(new Error("fixture SDK failure"));
    render(
      <FincodeCardFields
        bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox}
        onError={(error) => errors.push(error)}
        onMountStateChange={(state) => states.push(state)}
      />,
    );
    await waitFor(() => expect(errors.at(-1)?.stage).toBe("init"));
    expect(states).not.toContain(true);
    expect(provider.create).not.toHaveBeenCalled();
  });

  it.each([
    ["fincode.ui", () => provider.fincode.ui.mockImplementationOnce(() => { throw new Error("fixture UI failure"); })],
    ["ui.create", () => provider.create.mockImplementationOnce(() => { throw new Error("fixture create failure"); })],
  ])("classifies %s failure as ui_create", async (_label, fail) => {
    const errors: FincodeCardUiError[] = [];
    fail();
    render(
      <FincodeCardFields
        bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox}
        onError={(error) => errors.push(error)}
        onMountStateChange={() => undefined}
      />,
    );
    await waitFor(() => expect(errors.at(-1)?.stage).toBe("ui_create"));
    expect(provider.mount).not.toHaveBeenCalled();
  });

  it("requires a connected mount target before calling ui.mount", async () => {
    const errors: FincodeCardUiError[] = [];
    provider.create.mockImplementationOnce(() => {
      screen.getByLabelText("クレジットカード入力フォーム").remove();
    });
    render(
      <FincodeCardFields
        bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox}
        onError={(error) => errors.push(error)}
        onMountStateChange={() => undefined}
      />,
    );
    await waitFor(() => expect(errors.at(-1)?.stage).toBe("ui_mount"));
    expect(provider.mount).not.toHaveBeenCalled();
  });

  it("classifies ui.mount failure and never reports mounted", async () => {
    const errors: FincodeCardUiError[] = [];
    const states: boolean[] = [];
    provider.mount.mockImplementationOnce(() => { throw new Error("fixture mount failure"); });
    render(
      <FincodeCardFields
        bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox}
        onError={(error) => errors.push(error)}
        onMountStateChange={(state) => states.push(state)}
      />,
    );
    await waitFor(() => expect(errors.at(-1)?.stage).toBe("ui_mount"));
    expect(states).not.toContain(true);
  });

  it("delegates execution and registration without exposing raw fields", async () => {
    const ref = createRef<FincodeCardFieldsHandle>();
    render(<FincodeCardFields bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox} onMountStateChange={() => undefined} ref={ref} />);
    await waitFor(() => expect(provider.mount).toHaveBeenCalled());
    await expect(ref.current!.execute(action)).resolves.toBe("https://provider.example/3ds");
    await expect(ref.current!.register(intent)).resolves.toBe("provider-card-safe-reference");
    expect(provider.executePayment).toHaveBeenCalledWith(expect.objectContaining({ accessId: action.access_id, id: action.payment_id, payType: "Card", ui: provider.ui }));
    expect(provider.registerCard).toHaveBeenCalledWith(expect.objectContaining({ customerId: intent.provider_context.customer_id, useDefault: false, ui: provider.ui }));
    const source = readFileSync("src/components/payment/fincode-card-fields.tsx", "utf8");
    expect(source).not.toMatch(new RegExp(["getFormData", "local" + "Storage", "session" + "Storage", "postMessage"].join("|")));
    expect(source).not.toMatch(/\bpan\b|card_number|security_code/i);
  });

  it("clears the provider mount on unmount", async () => {
    const states: boolean[] = [];
    const view = render(<FincodeCardFields bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox} onMountStateChange={(state) => states.push(state)} />);
    await waitFor(() => expect(states.at(-1)).toBe(true));
    act(() => view.unmount());
    expect(states.at(-1)).toBe(false);
    expect(document.querySelector(".fincode-card-fields")).not.toBeInTheDocument();
  });

  it("cleans the prior mount when bootstrap changes", async () => {
    const states: boolean[] = [];
    const view = render(<FincodeCardFields bootstrap={PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox} onMountStateChange={(state) => states.push(state)} />);
    await waitFor(() => expect(provider.mount).toHaveBeenCalledTimes(1));
    const firstTarget = screen.getByLabelText("クレジットカード入力フォーム");
    const firstFrame = firstTarget.querySelector("iframe");
    expect(firstFrame).toBeInTheDocument();
    view.rerender(
      <FincodeCardFields
        bootstrap={{ ...PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox, public_api_key: "p_test_public-safe-fixture-rotated" }}
        onMountStateChange={(state) => states.push(state)}
      />,
    );
    await waitFor(() => expect(provider.mount).toHaveBeenCalledTimes(2));
    expect(firstFrame).not.toBeInTheDocument();
    expect(firstTarget.querySelector("iframe")).toBeInTheDocument();
    expect(states.at(-1)).toBe(true);
  });
});

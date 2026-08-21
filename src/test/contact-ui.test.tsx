import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_CONTACT_FIXTURE,
  PUBLIC_CONTACT_PROBLEM_FIXTURES,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import ContactPage from "@/app/contact/page";
import { SessionProvider } from "@/components/auth/session-provider";
import { ContactClientProvider } from "@/components/contact/contact-client-provider";
import { ContactForm } from "@/components/contact/contact-form";
import type { AuthClientAdapter, AuthSession, ContactClientAdapter } from "@/lib/platform";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const metadata = { idempotency_replayed: false, status: 200 } as const;

function authClient(session: AuthSession, overrides: Partial<AuthClientAdapter> = {}): AuthClientAdapter {
  return {
    completeEmailVerification: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue({ data: session, metadata }),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    resendEmailVerification: vi.fn(),
    ...overrides,
  } as AuthClientAdapter;
}

function contactClient(submitContact = vi.fn().mockResolvedValue({
  data: PUBLIC_CONTACT_FIXTURE.receipt,
  metadata: { ...metadata, status: 202 },
})): ContactClientAdapter {
  return { submitContact } as ContactClientAdapter;
}

function renderForm(
  session: AuthSession = PUBLIC_AUTH_FIXTURE.authenticated_session,
  client: ContactClientAdapter = contactClient(),
) {
  return render(
    <SessionProvider client={authClient(session)}>
      <ContactClientProvider client={client}>
        <ContactForm />
      </ContactClientProvider>
    </SessionProvider>,
  );
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("お名前"), { target: { value: "テスト利用者" } });
  fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "user@example.test" } });
  fireEvent.change(screen.getByLabelText("件名"), { target: { value: "商品について" } });
  fireEvent.change(screen.getByLabelText("お問い合わせ内容"), { target: { value: "問い合わせ本文です。" } });
}

function problem(source: Readonly<Record<string, unknown>>) {
  return new ApiProblemError(source as unknown as ConstructorParameters<typeof ApiProblemError>[0]);
}

describe("Contact page and form", () => {
  beforeEach(() => replace.mockClear());

  it("renders /contact only for an authenticated Session", async () => {
    render(<SessionProvider client={authClient(PUBLIC_AUTH_FIXTURE.authenticated_session)}><ContactPage /></SessionProvider>);
    expect(screen.getByRole("heading", { name: "お問い合わせ", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("ログイン中のアカウントからお問い合わせいただけます。氏名とメールアドレスを入力してください。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "お問い合わせを送信" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects a confirmed unauthenticated Session to exact /login without rendering the form", async () => {
    render(<SessionProvider client={authClient(PUBLIC_AUTH_FIXTURE.anonymous_session)}><ContactPage /></SessionProvider>);
    expect(screen.queryByRole("button", { name: "お問い合わせを送信" })).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(replace).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "お問い合わせを送信" })).not.toBeInTheDocument();
  });

  it("keeps the form hidden while Session is loading", async () => {
    let resolveSession!: (value: { readonly data: AuthSession; readonly metadata: typeof metadata }) => void;
    const pendingSession = new Promise<{ readonly data: AuthSession; readonly metadata: typeof metadata }>((resolve) => {
      resolveSession = resolve;
    });
    const client = authClient(PUBLIC_AUTH_FIXTURE.authenticated_session, {
      getCurrentSession: vi.fn(() => pendingSession),
    });
    render(<SessionProvider client={client}><ContactPage /></SessionProvider>);
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
    expect(screen.queryByRole("button", { name: "お問い合わせを送信" })).not.toBeInTheDocument();
    resolveSession({ data: PUBLIC_AUTH_FIXTURE.authenticated_session, metadata });
    expect(await screen.findByRole("button", { name: "お問い合わせを送信" })).toBeInTheDocument();
  });

  it("renders empty normal inputs for the authenticated presentation", async () => {
    renderForm();
    expect(await screen.findByText("ログイン中のアカウントからお問い合わせいただけます。氏名とメールアドレスを入力してください。")).toBeInTheDocument();
    expect(screen.getByLabelText("お名前")).toHaveValue("");
    expect(screen.getByLabelText("メールアドレス")).toHaveValue("");
  });

  it("marks canonical required fields, keeps phone optional, and exposes no honeypot input", () => {
    const view = renderForm();
    for (const label of ["お名前", "メールアドレス", "件名", "お問い合わせ内容"]) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
    expect(screen.getByLabelText("電話番号（任意）")).not.toBeRequired();
    expect(view.container.querySelector('[name="website"]')).toBeNull();
  });

  it("maps empty optional phone and the canonical honeypot on authenticated submit", async () => {
    const submitContact = vi.fn().mockResolvedValue({
      data: PUBLIC_CONTACT_FIXTURE.receipt,
      metadata: { ...metadata, status: 202 },
    });
    renderForm(PUBLIC_AUTH_FIXTURE.authenticated_session, contactClient(submitContact));
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));

    await waitFor(() => expect(submitContact).toHaveBeenCalledOnce());
    expect(submitContact).toHaveBeenCalledWith({
      body: "問い合わせ本文です。",
      email: "user@example.test",
      name: "テスト利用者",
      phone: null,
      subject: "商品について",
      website: "",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("お問い合わせを受け付けました");
    expect(screen.getByRole("status")).toHaveTextContent(`受付番号: ${PUBLIC_CONTACT_FIXTURE.receipt.receipt_code}`);
    expect(screen.getByRole("link", { name: "マイページへ戻る" })).toHaveAttribute("href", "/mypage");
  });

  it("submits optional phone for an authenticated member and offers the My Page return", async () => {
    const submitContact = vi.fn().mockResolvedValue({
      data: PUBLIC_CONTACT_FIXTURE.receipt,
      metadata: { ...metadata, status: 202 },
    });
    renderForm(PUBLIC_AUTH_FIXTURE.authenticated_session, contactClient(submitContact));
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("電話番号（任意）"), { target: { value: "000-0000-0000" } });
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));

    await waitFor(() => expect(submitContact).toHaveBeenCalledWith(expect.objectContaining({ phone: "000-0000-0000" })));
    expect(await screen.findByRole("link", { name: "マイページへ戻る" })).toHaveAttribute("href", "/mypage");
  });

  it("presents typed 422 field validation without exposing Backend detail", async () => {
    const submitContact = vi.fn().mockRejectedValue(problem(PUBLIC_CONTACT_PROBLEM_FIXTURES.validation));
    renderForm(PUBLIC_AUTH_FIXTURE.authenticated_session, contactClient(submitContact));
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("入力内容を確認してください。");
    expect(screen.getByText("The email field must be a valid email address.")).toBeInTheDocument();
    expect(submitContact).toHaveBeenCalledOnce();
  });

  it("presents typed 429 rate limiting", async () => {
    const submitContact = vi.fn().mockRejectedValue(problem(PUBLIC_CONTACT_PROBLEM_FIXTURES.rate_limited));
    renderForm(PUBLIC_AUTH_FIXTURE.authenticated_session, contactClient(submitContact));
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("送信回数が上限に達しました");
    expect(submitContact).toHaveBeenCalledOnce();
  });

  it("presents a typed network error and does not automatically resubmit", async () => {
    const submitContact = vi.fn().mockRejectedValue(new StorefrontTransportError("NETWORK_ERROR", "fixture network failure"));
    renderForm(PUBLIC_AUTH_FIXTURE.authenticated_session, contactClient(submitContact));
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("自動再送されていません");
    expect(submitContact).toHaveBeenCalledOnce();
  });

  it("presents an unknown error safely", async () => {
    const submitContact = vi.fn().mockRejectedValue(new Error("sensitive fixture detail"));
    renderForm(PUBLIC_AUTH_FIXTURE.authenticated_session, contactClient(submitContact));
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("予期しない問題が発生しました");
    expect(screen.queryByText("sensitive fixture detail")).not.toBeInTheDocument();
  });

  it("disables the form and prevents a double submit while the request is pending", async () => {
    let resolveSubmission!: (value: unknown) => void;
    const submitContact = vi.fn(() => new Promise((resolve) => { resolveSubmission = resolve; }));
    renderForm(PUBLIC_AUTH_FIXTURE.authenticated_session, contactClient(submitContact));
    fillRequiredFields();
    const submit = screen.getByRole("button", { name: "お問い合わせを送信" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(submitContact).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "送信中…" })).toBeDisabled();
    expect(screen.getByLabelText("お名前")).toBeDisabled();
    resolveSubmission({ data: PUBLIC_CONTACT_FIXTURE.receipt, metadata: { ...metadata, status: 202 } });
    expect(await screen.findByRole("status")).toHaveTextContent("お問い合わせを受け付けました");
  });
});

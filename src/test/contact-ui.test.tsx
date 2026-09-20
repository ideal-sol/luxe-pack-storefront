import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_CONTACT_FIXTURE,
  PUBLIC_CONTACT_PROBLEM_FIXTURES,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import LoginPage from "@/app/login/page";
import { contactLoginReturn } from "@/lib/contact-return";
import ContactPage from "@/app/contact/page";
import { SessionProvider } from "@/components/auth/session-provider";
import { ContactClientProvider } from "@/components/contact/contact-client-provider";
import { ContactForm } from "@/components/contact/contact-form";
import type { AuthClientAdapter, AuthSession, ContactClientAdapter } from "@/lib/platform";

const { replace, query } = vi.hoisted(() => ({ replace: vi.fn(), query: { value: "" } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(query.value),
}));

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
  beforeEach(() => { replace.mockClear(); query.value = ""; });

  it("renders /contact only for an authenticated Session", async () => {
    render(<SessionProvider client={authClient(PUBLIC_AUTH_FIXTURE.authenticated_session)}><ContactPage /></SessionProvider>);
    expect(screen.getByRole("heading", { name: "お問い合わせ", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("ログイン中のアカウントからお問い合わせいただけます。氏名とメールアドレスを入力してください。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "お問い合わせを送信" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects a confirmed unauthenticated Session to /login with the Contact return destination without rendering the form", async () => {
    render(<SessionProvider client={authClient(PUBLIC_AUTH_FIXTURE.anonymous_session)}><ContactPage /></SessionProvider>);
    expect(screen.queryByRole("button", { name: "お問い合わせを送信" })).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?returnTo=%2Fcontact"));
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
    const id = screen.getByLabelText("お問い合わせID");
    expect(id).toHaveValue("");
    expect(id).not.toBeRequired();
    expect(id).toHaveAttribute("readonly");
    expect(id).not.toBeDisabled();
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
    }, { idempotency_key: expect.any(String) });
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

    await waitFor(() => expect(submitContact).toHaveBeenCalledWith(expect.objectContaining({ phone: "000-0000-0000" }), { idempotency_key: expect.any(String) }));
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
  it.each([PUBLIC_CONTACT_FIXTURE.follow_up_input.inquiry_id, "malformed <id> & +"])("passes query %s unchanged and does not submit on arrival", async (id) => {
    query.value = new URLSearchParams({ inquiry_id: id }).toString();
    const originalQuery = query.value;
    const submitContact = vi.fn().mockResolvedValue({ data: PUBLIC_CONTACT_FIXTURE.receipt, metadata });
    renderForm(undefined, contactClient(submitContact));
    const field = screen.getByLabelText("お問い合わせID");
    expect(field).toHaveValue(id);
    expect(field).toHaveAttribute("readonly");
    expect(field).not.toBeDisabled();
    expect(submitContact).not.toHaveBeenCalled();
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    expect(submitContact).toHaveBeenCalledWith(expect.objectContaining({ inquiry_id: id }), { idempotency_key: expect.any(String) });
    expect(await screen.findByRole("status")).toHaveTextContent("お問い合わせを受け付けました");
    expect(query.value).toBe(originalQuery);
    expect(replace).not.toHaveBeenCalled();
  });

  it("omits an empty inquiry_id query from the payload", async () => {
    query.value = "inquiry_id=";
    const submitContact = vi.fn().mockResolvedValue({ data: PUBLIC_CONTACT_FIXTURE.receipt, metadata });
    renderForm(undefined, contactClient(submitContact));
    expect(screen.getByLabelText("お問い合わせID")).toHaveValue("");
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    await screen.findByText("お問い合わせを受け付けました");
    expect(submitContact.mock.calls[0]![0]).not.toHaveProperty("inquiry_id");
  });

  it("renders Backend malformed-ID validation through the existing field error flow", async () => {
    query.value = "inquiry_id=malformed";
    const submitContact = vi.fn().mockRejectedValue(problem({
      ...PUBLIC_CONTACT_PROBLEM_FIXTURES.validation,
      errors: { inquiry_id: ["The inquiry id field must be a valid UUID."] },
    }));
    renderForm(undefined, contactClient(submitContact));
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("入力内容を確認してください。");
    expect(screen.getByLabelText("お問い合わせID")).toHaveAccessibleDescription("The inquiry id field must be a valid UUID.");
    expect(submitContact).toHaveBeenCalledWith(expect.objectContaining({ inquiry_id: "malformed" }), expect.anything());
    expect(screen.queryByText(/お問い合わせIDが見つかりません|このお問い合わせIDは使用できません/)).not.toBeInTheDocument();
  });

  it("keeps the same key on a manual transport retry and creates another for a later identical inquiry", async () => {
    const submitContact = vi.fn()
      .mockRejectedValueOnce(new StorefrontTransportError("NETWORK_ERROR", "fixture"))
      .mockResolvedValue({ data: PUBLIC_CONTACT_FIXTURE.receipt, metadata });
    const view = renderForm(undefined, contactClient(submitContact));
    expect(submitContact).not.toHaveBeenCalled();
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    await screen.findByRole("alert");
    const first = submitContact.mock.calls[0]!;
    expect(first[1].idempotency_key).toEqual(expect.any(String));
    expect(first[1].idempotency_key.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    await screen.findByText("お問い合わせを受け付けました");
    expect(submitContact.mock.calls[1]!).toEqual(first);
    view.unmount();
    renderForm(undefined, contactClient(submitContact));
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    await screen.findByText("お問い合わせを受け付けました");
    expect(submitContact.mock.calls[2]![0]).toEqual(first[0]);
    expect(submitContact.mock.calls[2]![1].idempotency_key).not.toBe(first[1].idempotency_key);
  });

  it("starts a new operation after editing even when the final body is identical", async () => {
    const submitContact = vi.fn().mockRejectedValue(new StorefrontTransportError("NETWORK_ERROR", "fixture"));
    renderForm(undefined, contactClient(submitContact));
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    await screen.findByRole("alert");
    fireEvent.change(screen.getByLabelText("件名"), { target: { value: "別の件名" } });
    fireEvent.change(screen.getByLabelText("件名"), { target: { value: "商品について" } });
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    await screen.findByRole("alert");
    expect(submitContact.mock.calls[1]![0]).toEqual(submitContact.mock.calls[0]![0]);
    expect(submitContact.mock.calls[1]![1]).not.toEqual(submitContact.mock.calls[0]![1]);
  });

  it("returns from the existing login flow to Contact with its query intact", async () => {
    const id = PUBLIC_CONTACT_FIXTURE.follow_up_input.inquiry_id;
    query.value = `inquiry_id=${id}`;
    const view = render(<SessionProvider client={authClient(PUBLIC_AUTH_FIXTURE.anonymous_session)}><ContactPage /></SessionProvider>);
    const destination = `/contact?inquiry_id=${id}`;
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/login?returnTo=${encodeURIComponent(destination)}`));
    expect(screen.queryByLabelText("お問い合わせID")).not.toBeInTheDocument();
    const loginUrl = new URL(replace.mock.calls[0]![0], "https://storefront.test");
    view.unmount();
    const login = vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.authenticated_session, metadata });
    const page = await LoginPage({ searchParams: Promise.resolve({ returnTo: loginUrl.searchParams.get("returnTo")! }) });
    const loginView = render(<SessionProvider client={authClient(PUBLIC_AUTH_FIXTURE.anonymous_session, { login })}>{page}</SessionProvider>);
    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "user@example.test" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "fixture-password" } });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith(destination));
    loginView.unmount();
    query.value = new URL(replace.mock.calls.at(-1)![0], "https://storefront.test").search;
    render(<SessionProvider client={authClient(PUBLIC_AUTH_FIXTURE.authenticated_session)}><ContactPage /></SessionProvider>);
    expect(await screen.findByLabelText("お問い合わせID")).toHaveValue(id);
  });

  it.each([undefined, ["/contact"], "https://outside.test/contact", "//outside.test", "/contact/../login", "/contact#fragment", "/contact?x=\nheader", "/contact?x=\\outside"])("rejects unsafe or unrelated login destinations %s", (value) => {
    expect(contactLoginReturn(value)).toBe("/mypage");
  });

  it.each([422, 503])("handles the pending operation after HTTP %s", async (status) => {
    const submitContact = vi.fn()
      .mockRejectedValueOnce(problem({ ...PUBLIC_CONTACT_PROBLEM_FIXTURES.validation, status }))
      .mockResolvedValue({ data: PUBLIC_CONTACT_FIXTURE.receipt, metadata });
    renderForm(undefined, contactClient(submitContact));
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    await screen.findByText("お問い合わせを受け付けました");
    const firstKey = submitContact.mock.calls[0]![1].idempotency_key;
    const nextKey = submitContact.mock.calls[1]![1].idempotency_key;
    if (status >= 500) expect(nextKey).toBe(firstKey);
    else expect(nextKey).not.toBe(firstKey);
  });

});

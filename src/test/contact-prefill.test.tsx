import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_CONTACT_FIXTURE } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { ContactAccessBoundary } from "@/components/contact/contact-access-boundary";
import { ContactClientProvider } from "@/components/contact/contact-client-provider";
import { ContactForm } from "@/components/contact/contact-form";
import type { AuthClientAdapter, AuthSession, SmsVerificationStatus } from "@/lib/platform";

const { query, replace } = vi.hoisted(() => ({ query: { value: "" }, replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(query.value),
}));
const metadata = { idempotency_replayed: false, status: 200 } as const;
const registered: SmsVerificationStatus = { verified: true, phone: "+819000000001", phone_masked: "090****0001", challenge: null };
const noPhone: SmsVerificationStatus = { verified: false, phone: null, phone_masked: null, challenge: null };

function Refresh() {
  const { refreshSession } = useSession();
  return <button onClick={() => void refreshSession()}>Session refresh</button>;
}

function mount(session: AuthSession = PUBLIC_AUTH_FIXTURE.authenticated_session, status = registered, overrides: Partial<AuthClientAdapter> = {}) {
  const auth = {
    getCurrentSession: vi.fn().mockResolvedValue({ data: session, metadata }),
    getSmsVerificationStatus: vi.fn().mockResolvedValue({ data: status, metadata }),
    createEmailChangeRequest: vi.fn(), sendSmsVerification: vi.fn(), verifySmsCode: vi.fn(),
    ...overrides,
  } as unknown as AuthClientAdapter;
  const submitContact = vi.fn().mockResolvedValue({ data: PUBLIC_CONTACT_FIXTURE.receipt, metadata });
  render(<SessionProvider client={auth}>
    <Refresh />
    <ContactAccessBoundary><ContactClientProvider client={{ submitContact }}><ContactForm /></ContactClientProvider></ContactAccessBoundary>
  </SessionProvider>);
  return { auth, submitContact };
}

function fillMessage() {
  fireEvent.change(screen.getByLabelText("件名"), { target: { value: "Question" } });
  fireEvent.change(screen.getByLabelText("お問い合わせ内容"), { target: { value: "Contact body" } });
}

describe("Contact registration defaults", () => {
  beforeEach(() => { query.value = ""; replace.mockClear(); });

  it.each(["", `inquiry_id=${PUBLIC_CONTACT_FIXTURE.follow_up_input.inquiry_id}`])("prefills required editable fields for %s", async (value) => {
    query.value = value;
    mount();
    expect(await screen.findByLabelText("お名前")).toHaveValue(PUBLIC_AUTH_FIXTURE.authenticated_session.user.display_name);
    expect(screen.getByLabelText("メールアドレス")).toHaveValue(PUBLIC_AUTH_FIXTURE.authenticated_session.user.email);
    expect(screen.getByLabelText("電話番号")).toHaveValue(registered.phone);
    for (const label of ["お名前", "メールアドレス", "電話番号"]) {
      const field = screen.getByLabelText(label);
      expect(field).toBeRequired();
      expect(field).not.toBeDisabled();
      expect(field).not.toHaveAttribute("readonly");
    }
    expect(screen.getByLabelText("お問い合わせID")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("お問い合わせID")).toHaveValue(new URLSearchParams(value).get("inquiry_id") ?? "");
  });

  it.each([null, "+819000000099"])("leaves phone visible and empty when the status is unverified/revoked (%s)", async (phone) => {
    const { submitContact } = mount(undefined, { ...noPhone, phone });
    await screen.findByLabelText("お名前");
    const input = screen.getByLabelText("電話番号");
    expect(input).toBeVisible();
    expect(input).toHaveValue("");
    expect(input).toBeRequired();
    fillMessage();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    expect(submitContact).not.toHaveBeenCalled();
    expect(input).toBeInvalid();
    fireEvent.change(input, { target: { value: "0312345678" } });
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    await waitFor(() => expect(submitContact).toHaveBeenCalledWith(expect.objectContaining({ phone: "0312345678" }), expect.anything()));
  });

  it("keeps missing name empty and rejects submission until it is entered", async () => {
    const { submitContact } = mount({ authenticated: true, user: { ...PUBLIC_AUTH_FIXTURE.authenticated_session.user, display_name: null } });
    const name = await screen.findByLabelText("お名前");
    expect(name).toHaveValue("");
    fillMessage();
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    expect(name).toBeInvalid();
    expect(submitContact).not.toHaveBeenCalled();
  });

  it("requires every identity input after the user clears an initial value", async () => {
    const { submitContact } = mount();
    await screen.findByLabelText("お名前");
    fillMessage();
    for (const label of ["お名前", "メールアドレス", "電話番号"]) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      const initial = input.value;
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
      expect(submitContact).not.toHaveBeenCalled();
      expect(input).toBeInvalid();
      fireEvent.change(input, { target: { value: initial } });
    }
  });

  it("uses existing loading UI until registered phone is available", async () => {
    let resolve!: (response: { data: SmsVerificationStatus; metadata: typeof metadata }) => void;
    const getSmsVerificationStatus = vi.fn(() => new Promise<{ data: SmsVerificationStatus; metadata: typeof metadata }>((done) => { resolve = done; }));
    mount(undefined, registered, { getSmsVerificationStatus });
    await waitFor(() => expect(getSmsVerificationStatus).toHaveBeenCalledOnce());
    expect(screen.queryByLabelText("お名前")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
    await act(async () => resolve({ data: registered, metadata }));
    expect(await screen.findByLabelText("電話番号")).toHaveValue(registered.phone);
  });

  it("allows manual phone entry when its read fails", async () => {
    const { auth } = mount(undefined, noPhone, { getSmsVerificationStatus: vi.fn().mockRejectedValue(new Error("private detail")) });
    expect(await screen.findByLabelText("電話番号")).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("電話番号を入力してください");
    expect(screen.queryByText("private detail")).not.toBeInTheDocument();
    expect(auth.sendSmsVerification).not.toHaveBeenCalled();
  });

  it("preserves all edits, inquiry ID and the same inputs across asynchronous session refresh, and submits only Contact", async () => {
    query.value = `inquiry_id=${PUBLIC_CONTACT_FIXTURE.follow_up_input.inquiry_id}`;
    let resolve!: (response: { data: AuthSession; metadata: typeof metadata }) => void;
    const getCurrentSession = vi.fn().mockResolvedValueOnce({ data: PUBLIC_AUTH_FIXTURE.authenticated_session, metadata })
      .mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { auth, submitContact } = mount(undefined, registered, { getCurrentSession });
    const name = await screen.findByLabelText("お名前");
    fireEvent.change(name, { target: { value: "Contact Name" } });
    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "contact@example.test" } });
    fireEvent.change(screen.getByLabelText("電話番号"), { target: { value: "0312345678" } });
    fillMessage();
    fireEvent.click(screen.getByRole("button", { name: "Session refresh" }));
    await waitFor(() => expect(getCurrentSession).toHaveBeenCalledTimes(2));
    expect(name).not.toBeVisible();
    await act(async () => resolve({ data: { authenticated: true, user: { ...PUBLIC_AUTH_FIXTURE.authenticated_session.user, display_name: "Updated registration", email: "updated@example.test" } }, metadata }));
    expect(await screen.findByLabelText("お名前")).toBe(name);
    expect(name).toBeVisible();
    expect(name).toHaveValue("Contact Name");
    expect(screen.getByLabelText("メールアドレス")).toHaveValue("contact@example.test");
    expect(screen.getByLabelText("電話番号")).toHaveValue("0312345678");
    fireEvent.click(screen.getByRole("button", { name: "お問い合わせを送信" }));
    await waitFor(() => expect(submitContact).toHaveBeenCalledWith(expect.objectContaining({ name: "Contact Name", email: "contact@example.test", phone: "0312345678", inquiry_id: PUBLIC_CONTACT_FIXTURE.follow_up_input.inquiry_id }), expect.anything()));
    expect(auth.getSmsVerificationStatus).toHaveBeenCalledOnce();
    for (const mutation of [auth.createEmailChangeRequest, auth.sendSmsVerification, auth.verifySmsCode]) expect(mutation).not.toHaveBeenCalled();
  });

  it("discards prior inputs when the current account changes", async () => {
    const nextSession: AuthSession = { authenticated: true, user: { ...PUBLIC_AUTH_FIXTURE.authenticated_session.user, id: "0198a001-0000-7000-8000-000000000599", display_name: "Other User", email: "other@example.test" } };
    mount(undefined, noPhone, { getCurrentSession: vi.fn().mockResolvedValueOnce({ data: PUBLIC_AUTH_FIXTURE.authenticated_session, metadata }).mockResolvedValueOnce({ data: nextSession, metadata }) });
    fireEvent.change(await screen.findByLabelText("お名前"), { target: { value: "Private input" } });
    fireEvent.click(screen.getByRole("button", { name: "Session refresh" }));
    await waitFor(() => expect(screen.getByLabelText("お名前")).toHaveValue("Other User"));
    expect(screen.getByLabelText("メールアドレス")).toHaveValue("other@example.test");
    expect(screen.getByLabelText("電話番号")).toHaveValue("");
  });
});

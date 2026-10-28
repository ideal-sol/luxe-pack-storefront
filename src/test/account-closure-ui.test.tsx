import { PUBLIC_ACCOUNT_CLOSURE_FIXTURES, PUBLIC_AUTH_FIXTURE } from "@oripa/storefront-testkit";
import { createMockFetch } from "@oripa/storefront-testkit/mock";
import { createBrowserAccountClosureClient } from "@/lib/platform/account-closure-client";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountClosureGuide, AccountClosureScreen, AccountClosureFlow, ClosureUiError, type ClosureActions, type ClosurePreview } from "@/components/account/account-closure-guide";
import { accountClosureRoute, publicRoutes, requiresSmsVerification } from "@/lib/routes/navigation";
import { SESSION_ACCESS_REJECTED } from "@/lib/platform/browser-client";

const mocks = vi.hoisted(() => ({ state: { status: "authenticated", session: { user: { id: "member-a" } } } as { status: string; session?: { user: { id: string } } }, replace: vi.fn(), showToast: vi.fn() }));
vi.mock("@/components/auth/session-provider", () => ({ useSession: () => ({ state: mocks.state }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/components/common/toast-provider", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
const preview: ClosurePreview = { pointBalance: 12500, unclaimedPrizeCount: 3, shippingInProgressCount: 1, canClose: true, verificationMethod: "password", maskedEmail: "t***@example.test" };
function setup(changes: Partial<ClosurePreview> = {}) {
  const actions: ClosureActions = { load: vi.fn().mockResolvedValue({ ...preview, ...changes }), sendCode: vi.fn().mockImplementation(() => Promise.resolve({ resendAvailableAt: Date.now() + 60000, expiresInMinutes: 10 })), confirm: vi.fn().mockResolvedValue(undefined), complete: vi.fn() };
  return actions;
}
async function fill(value = "fixture-password") {
  await screen.findByRole("checkbox");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText(/確認のため再入力|登録メールアドレスへ送信/), { target: { value } });
}
beforeEach(() => { vi.clearAllMocks(); mocks.state = { status: "authenticated", session: { user: { id: "member-a" } } }; });
it("keeps the production route fail-closed when configuration is unavailable", () => {
  render(<AccountClosureGuide client={null} />);
  expect(screen.getByText("情報を表示できませんでした")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(requiresSmsVerification(accountClosureRoute)).toBe(false);
  expect(publicRoutes).toContain(accountClosureRoute);
});
it.each(["unauthenticated", "session-expired"])("handles %s", status => {
  mocks.state = { status }; render(<AccountClosureGuide />);
  expect(screen.getByRole("link", { name: "ログインへ" })).toHaveAttribute("href", "/login");
});
it("shows preview counts and only the approved conditional shipping text", async () => {
  render(<AccountClosureScreen actions={setup()} />);
  expect(await screen.findByText("12,500 pt")).toBeInTheDocument();
  expect(screen.getByText("3 枚")).toBeInTheDocument();
  expect(screen.getByText("発送のお手続き中のカード（1枚）は、退会後もお届けします。")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "獲得カードを確認・発送を依頼する" })).toHaveAttribute("href", "/mypage/prizes");
  expect(screen.getByRole("button", { name: "退会する" })).toBeDisabled();
});
it("shows zero counts and omits conditional shipping/claim guidance", async () => {
  render(<AccountClosureScreen actions={setup({ pointBalance: 0, unclaimedPrizeCount: 0, shippingInProgressCount: 0 })} />);
  expect(await screen.findByText("0 pt")).toBeInTheDocument(); expect(screen.getByText("0 枚")).toBeInTheDocument();
  expect(screen.queryByText(/発送のお手続き中/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "獲得カードを確認・発送を依頼する" })).not.toBeInTheDocument();
});
it("replaces the form with the yellow blocked guidance", async () => {
  render(<AccountClosureScreen actions={setup({ canClose: false })} />);
  expect(await screen.findByText("現在、退会のお手続きができません")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});
it("submits preview values once and stays locked until completion", async () => {
  const actions = setup(); let finish!: () => void;
  vi.mocked(actions.confirm).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<AccountClosureScreen actions={actions} />); await fill();
  fireEvent.click(screen.getByRole("button", { name: "表示" }));
  expect(screen.getByLabelText(/確認のため再入力/)).toHaveAttribute("type", "text");
  fireEvent.click(screen.getByRole("button", { name: "退会する" }));
  fireEvent.submit(screen.getByRole("checkbox").closest("form")!);
  expect(actions.confirm).toHaveBeenCalledExactlyOnceWith({ confirmed: true, expectedPointBalance: 12500, expectedUnclaimedPrizeCount: 3, password: "fixture-password", operationKey: expect.any(String) });
  await act(async () => finish());
  expect(actions.complete).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "処理中…" })).toBeDisabled();
});
it.each(["password", "email_code"] as const)("clears invalid %s while keeping consent", async kind => {
  const actions = setup({ verificationMethod: kind });
  vi.mocked(actions.confirm).mockRejectedValue(new ClosureUiError(kind));
  render(<AccountClosureScreen actions={actions} />); await fill(kind === "password" ? "wrong-password" : "123456");
  fireEvent.click(screen.getByRole("button", { name: "退会する" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText(/確認のため再入力|登録メールアドレスへ送信/)).toHaveValue("");
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(actions.complete).not.toHaveBeenCalled();
});
it("refreshes STALE numbers and requires new consent", async () => {
  const actions = setup(); vi.mocked(actions.confirm).mockRejectedValue(new ClosureUiError("stale"));
  vi.mocked(actions.load).mockResolvedValueOnce(preview).mockResolvedValue({ ...preview, pointBalance: 42, unclaimedPrizeCount: 0 });
  render(<AccountClosureScreen actions={actions} />); await fill();
  fireEvent.click(screen.getByRole("button", { name: "退会する" }));
  expect(await screen.findByText("42 pt")).toBeInTheDocument();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("alert")).toHaveTextContent("保有ポイントまたは獲得カードの数が変わりました");
});
it("uses server resend timing and sends only numeric OTP confirmation", async () => {
  const actions = setup({ verificationMethod: "email_code" });
  render(<AccountClosureScreen actions={actions} />);
  fireEvent.click(await screen.findByRole("button", { name: "コードを送信" }));
  expect(await screen.findByRole("button", { name: "再送信" })).toBeDisabled();
  expect(screen.getByText(/有効期限は10分です/)).toHaveTextContent("t***@example.test");
  await fill("abcdef");
  expect(screen.getByRole("button", { name: "退会する" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/登録メールアドレスへ送信/), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "退会する" }));
  await waitFor(() => expect(actions.complete).toHaveBeenCalledOnce());
  expect(actions.confirm).toHaveBeenCalledWith(expect.objectContaining({ emailCode: "123456" }));
});
it("retains the same operation key after an uncertain failure", async () => {
  const actions = setup(); vi.mocked(actions.confirm).mockRejectedValueOnce(new Error("private"));
  render(<AccountClosureScreen actions={actions} />); await fill();
  fireEvent.click(screen.getByRole("button", { name: "退会する" })); await screen.findByRole("alert");
  fireEvent.change(screen.getByLabelText(/確認のため再入力/), { target: { value: "fixture-password" } });
  fireEvent.click(screen.getByRole("button", { name: "退会する" }));
  await waitFor(() => expect(actions.complete).toHaveBeenCalledOnce());
  const calls = vi.mocked(actions.confirm).mock.calls;
  expect(calls[0]![0].operationKey).toBe(calls[1]![0].operationKey);
  expect(screen.queryByText("private")).not.toBeInTheDocument();
});
it("ignores completion after leaving the page", async () => {
  const actions = setup(); let finish!: () => void;
  vi.mocked(actions.confirm).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = render(<AccountClosureScreen actions={actions} />); await fill();
  fireEvent.click(screen.getByRole("button", { name: "退会する" })); view.unmount();
  await act(async () => finish()); expect(actions.complete).not.toHaveBeenCalled();
});
it.each(["session", "verification", "retry"] as const)("handles preview %s safely", async kind => {
  const actions = setup(); vi.mocked(actions.load).mockRejectedValue(new ClosureUiError(kind));
  render(<AccountClosureScreen actions={actions} />);
  expect(await screen.findByText(kind === "session" ? "ログインしてください" : kind === "verification" ? "メールアドレスと電話番号の認証をご確認ください。" : "情報を表示できませんでした")).toBeInTheDocument();
  expect(screen.queryByText("決済の処理中のため", { exact: false })).not.toBeInTheDocument();
});
it("invalidates the local session and emits one completion toast before navigating home", async () => {
  const reject = vi.fn(); window.addEventListener(SESSION_ACCESS_REJECTED, reject);
  render(<AccountClosureFlow actions={setup()} />); await fill();
  fireEvent.click(screen.getByRole("button", { name: "退会する" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
  expect(mocks.showToast).toHaveBeenCalledExactlyOnceWith("退会が完了しました", "ご利用ありがとうございました。");
  expect(reject).toHaveBeenCalledOnce();
  expect((reject.mock.calls[0]![0] as CustomEvent).detail).toBe("ACCOUNT_CLOSED");
  window.removeEventListener(SESSION_ACCESS_REJECTED, reject);
});

const origin = "https://storefront.test/platform";
function canonical() {
  const mock = createMockFetch();
  const client = createBrowserAccountClosureClient({ baseUrl: origin, defaultTimeoutMs: 1000, siteVersion: "0.1.0" }, { cookie_reader: () => "a".repeat(64), fetch: mock.fetch });
  return { mock, client };
}

it("connects the actual route to the canonical preview and successful password mutation", async () => {
  const h = canonical();
  h.mock.enqueueJson({ method: "GET", url: origin + "/me/account-closure" }, { body: PUBLIC_ACCOUNT_CLOSURE_FIXTURES.password });
  h.mock.enqueueJson({ method: "GET", url: origin + "/auth/session" }, { body: PUBLIC_AUTH_FIXTURE.authenticated_session });
  h.mock.enqueueJson({ method: "POST", url: origin + "/me/account-closure" }, { body: { data: { closed_at: "2026-10-28T00:00:00Z" } } });
  render(<AccountClosureGuide client={h.client} />); await fill();
  fireEvent.click(screen.getByRole("button", { name: "退会する" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
  expect(mocks.showToast).toHaveBeenCalledExactlyOnceWith("退会が完了しました", "ご利用ありがとうございました。");
  expect(JSON.parse(h.mock.requests[2]!.body!)).toMatchObject({ expected_point_balance: 12500, expected_unclaimed_prize_count: 3, password: "fixture-password" });
  expect(h.mock.requests[2]!.headers["idempotency-key"]).toBeTruthy();
  h.mock.assertExhausted();
});
it("refreshes the canonical preview after a real typed STALE conflict", async () => {
  const h = canonical();
  h.mock.enqueueJson({ method: "GET", url: origin + "/me/account-closure" }, { body: PUBLIC_ACCOUNT_CLOSURE_FIXTURES.password });
  h.mock.enqueueJson({ method: "GET", url: origin + "/auth/session" }, { body: PUBLIC_AUTH_FIXTURE.authenticated_session });
  h.mock.enqueueProblem({ method: "POST", url: origin + "/me/account-closure" }, { code: "ACCOUNT_CLOSURE_STALE", status: 409, type: "https://storefront.test/problems/closure", title: "Changed", request_id: "fixture", retryable: false });
  h.mock.enqueueJson({ method: "GET", url: origin + "/me/account-closure" }, { body: { data: { ...PUBLIC_ACCOUNT_CLOSURE_FIXTURES.password.data, point_balance: 42 } } });
  render(<AccountClosureGuide client={h.client} />); await fill();
  fireEvent.click(screen.getByRole("button", { name: "退会する" }));
  expect(await screen.findByText("42 pt")).toBeInTheDocument();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(mocks.showToast).not.toHaveBeenCalled();
  h.mock.assertExhausted();
});
it("drops preview, OTP, consent and an old in-flight completion on a different member login", async () => {
  const a = setup({ verificationMethod: "email_code" }); let finish!: () => void;
  vi.mocked(a.confirm).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = render(<AccountClosureGuide client={a} />); await fill("123456");
  fireEvent.click(screen.getByRole("button", { name: "退会する" }));
  mocks.state = { status: "authenticated", session: { user: { id: "member-b" } } };
  const b = setup({ pointBalance: 7 });
  view.rerender(<AccountClosureGuide client={b} />);
  expect(await screen.findByText("7 pt")).toBeInTheDocument();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByLabelText(/確認のため再入力/)).toHaveValue("");
  expect(screen.queryByRole("button", { name: "再送信" })).not.toBeInTheDocument();
  await act(async () => finish());
  expect(mocks.showToast).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled();
});
it.each(["session", "verification", "blocked"] as const)("handles %s during submission without completion", async kind => {
  const a = setup(); vi.mocked(a.confirm).mockRejectedValue(new ClosureUiError(kind));
  if (kind === "blocked") vi.mocked(a.load).mockResolvedValueOnce(preview).mockResolvedValue({ ...preview, canClose: false });
  render(<AccountClosureGuide client={a} />); await fill();
  fireEvent.click(screen.getByRole("button", { name: "退会する" }));
  expect(await screen.findByText(kind === "session" ? "ログインしてください" : kind === "verification" ? "メールアドレスと電話番号の認証をご確認ください。" : "現在、退会のお手続きができません")).toBeInTheDocument();
  expect(mocks.showToast).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled();
});
it("disables submission after a rate-limit response until the server retry time", async () => {
  const a = setup(); vi.mocked(a.confirm).mockRejectedValue(new ClosureUiError("retry", Date.now() + 30000));
  render(<AccountClosureScreen actions={a} />); await fill();
  fireEvent.click(screen.getByRole("button", { name: "退会する" })); await screen.findByRole("alert");
  fireEvent.change(screen.getByLabelText(/確認のため再入力/), { target: { value: "fixture-password" } });
  expect(screen.getByRole("button", { name: "退会する" })).toBeDisabled();
  expect(a.confirm).toHaveBeenCalledOnce();
});

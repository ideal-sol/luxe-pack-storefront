import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountClosureGuide, AccountClosureScreen, AccountClosureFlow, ClosureUiError, type ClosureActions, type ClosurePreview } from "@/components/account/account-closure-guide";
import { accountClosureRoute, publicRoutes, requiresSmsVerification } from "@/lib/routes/navigation";
import { SESSION_ACCESS_REJECTED } from "@/lib/platform/browser-client";

const mocks = vi.hoisted(() => ({ state: { status: "authenticated" }, replace: vi.fn(), showToast: vi.fn() }));
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
beforeEach(() => { vi.clearAllMocks(); mocks.state = { status: "authenticated" }; });
it("keeps the production route fail-closed until the formal contract exists", () => {
  render(<AccountClosureGuide />);
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
  window.removeEventListener(SESSION_ACCESS_REJECTED, reject);
});

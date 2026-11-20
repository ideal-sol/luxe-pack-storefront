import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import vm from "node:vm";

const uuid = "00000000-0000-4000-8000-000000000001";
const paymentId = "00000000-0000-4000-9000-000000000001";
const emailHash = createHash("sha256").update("test.user@example.com").digest("hex");
const verifiedBytes = new Set();
const execute = (code, context) => vm.runInContext(code, context, { timeout: 1000 });

// Register actual Turbopack factories without loading the Next runtime, DOM, tags,
// network or dependencies. Only React hooks and external I/O are mocked below.
function runtime(chunks, selected, mode, mail, runtimeId, storageDenied = false, storage = new Map(), locks) {
  const modules = new Map();
  const registered = [];
  const events = [], effects = [], states = [], refs = [];
  let stateIndex = 0, refIndex = 0, touched = 0, digestCalls = 0, finish, wallet = 0;
  const session = { status: "authenticated", session: { user: { id: mail === "no-user" ? null : uuid, email: mail === "missing" ? null : mail === "fullwidth" ? "　ＴＥＳＴ．ＵＳＥＲ＠ＥＸＡＭＰＬＥ．ＣＯＭ\t\n" : "  Test.User@Example.COM " } } };
  const payment = { id: paymentId, status: mode, amount: { amount: 1500, currency: "JPY" }, grant: { paid_points: 9999, bonus_points: 777, total_points: 10776 }, method: "credit_card" };
  const polling = { status: "ready", payment };
  const sms = { verified: mode === "redisplay", phone: "09000000000", challenge: { id: "synthetic-challenge", status: "accepted", delivery_state: "accepted", expires_at: "2099-01-01T00:00:00Z" } };
  // Frozen I/O result for an inlined polling hook. A new GET remains pending:
  // no network or timers, and no replacement of its compiled status predicate.
  const client = { getPayment: () => new Promise(() => {}) };
  const window = {};
  Object.defineProperties(window, {
    dataLayer: { configurable: true, get() { touched++; return events; } },
    localStorage: { get() { touched++; if (storageDenied) throw new Error("synthetic storage denial"); return { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }; } },
  });
  const context = vm.createContext({
    // Time is external I/O. Register inert callbacks for an inlined polling hook;
    // deadline/interval behavior is covered by focused fake-clock hook tests.
    setTimeout: () => 1, clearTimeout: () => {},
    window, TextEncoder, navigator: { locks }, process: { env: { NEXT_PUBLIC_GTM_ID: runtimeId } },
    crypto: { subtle: { digest: (algorithm, bytes) => {
      digestCalls++;
      assert.equal(algorithm, "SHA-256");
      assert.equal(Buffer.from(bytes).toString("utf8"), "test.user@example.com");
      return new Promise((resolve, reject) => { finish = async () => {
        if (mail === "failure") reject(new Error("synthetic crypto failure"));
        else resolve(await webcrypto.subtle.digest(algorithm, bytes));
      }; });
    } } },
    TURBOPACK: { push(chunk) {
      let ids = [];
      for (const part of chunk.slice(1)) {
        if (typeof part === "number") ids.push(part);
        else if (typeof part === "function") { for (const id of ids) { modules.set(id, part); registered.push({ id, factory: part }); } ids = []; }
        else assert.fail("unsupported compiled module registration");
      }
    } },
  });
  for (const chunk of chunks) execute(chunk.code, context);
  if (selected) {
    const original = registered.find(entry => entry.id === selected.id && entry.factory.toString() === selected.factory.toString());
    assert(original, "compiled module variant missing");
    modules.set(selected.id, original.factory);
  }
  const cache = new Map();
  let surface;
  const refreshWallet = () => { wallet++; return Promise.resolve(); };
  // Turbopack may shorten exports of external hooks/presenters. Their mocked I/O
  // signatures are independent of those names; analytics modules are always real.
  const external = (...args) => {
    if (args.length >= 3) return polling;
    if (!args.length) return { client, refreshWallet, state: session };
    if (args[0] && typeof args[0] === "object") return { fieldErrors: {}, retryAfterSeconds: null, reauthenticationRequired: false };
    return null;
  };
  const namespace = new Proxy({
    jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }),
    useState: initial => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = surface === "sms" ? [sms, mode === "redisplay" ? "verified" : "otp", uuid, false, false, "09000000000", "000000", "", null, null, null, 0, 0, mode === "phone-change"][index] : index === 2 ? { client, pid: paymentId, state: polling, revision: 0 } : initial;
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef: initial => { const index = refIndex++; return refs[index] ??= { current: initial }; },
    useEffect: callback => { effects.push(callback); }, useCallback: callback => callback,
    useSession: () => ({ state: session, verifySmsCode: async () => {
      if (mode === "failed") throw new Error("synthetic SMS failure");
      return { ...sms, verified: mode !== "unverified-result", challenge: null };
    }, getSmsVerificationStatus: async () => ({ ...sms, verified: true, challenge: null }) }),
    usePaymentClient: () => ({ client }), usePaymentPolling: () => polling,
    usePointClient: () => ({ refreshWallet }),
    presentSmsProblem: () => ({ fieldErrors: {}, retryAfterSeconds: null, reauthenticationRequired: false }),
    paymentMethodLabel: () => "synthetic", formatVerifiedPhone: value => value,
  }, { get(target, key) { return key in target ? target[key] : external; } });
  const isAnalytics = factory => factory.toString().includes("oripoke:cv:");
  function load(id) {
    if (cache.has(id)) return cache.get(id);
    const factory = modules.get(id);
    if (!factory) return namespace;
    const exports = {}; cache.set(id, exports);
    const bridge = {
      i: imported => modules.has(imported) && isAnalytics(modules.get(imported)) ? load(imported) : namespace,
      s: values => {
        for (let index = 0; index < values.length;) {
          const name = values[index++], value = values[index++];
          if (value === 0) exports[name] = values[index++];
          else { assert.equal(typeof value, "function"); Object.defineProperty(exports, name, { get: value }); }
        }
      },
    };
    context.__factory = factory; context.__bridge = bridge;
    execute("__factory(__bridge)", context);
    return exports;
  }
  function component(name) {
    for (const [id, factory] of modules) {
      if (!factory.toString().includes(name)) continue;
      const value = load(id)[name];
      if (typeof value === "function") return value;
    }
    assert.fail(`compiled ${name} export missing`);
  }
  function exported(name) {
    const candidates = new Map();
    for (const [id, factory] of modules) {
      if (!isAnalytics(factory)) continue;
      const exports = load(id);
      const value = exports[name];
      if (typeof value === "function") return value;
      // Turbopack shortens internal export names in actual production chunks.
      // Identify only the narrow, reviewed function roles, without replacing code.
      for (const candidate of Object.values(exports)) {
        if (typeof candidate !== "function") continue;
        const source = candidate.toString();
        const matches = name === "reportPurchaseComplete" ? source.includes("transaction_id") && source.includes('"in_progress"')
          : name === "recoverPurchases" ? source.includes(".getPayment(")
          : name === "rememberPurchase" ? source.includes('"aborted"') && source.includes(".status") && !source.includes(".getPayment(") : false;
        if (matches) candidates.set(source, candidate);
      }
    }
    if (candidates.size === 1) return [...candidates.values()][0];
    assert.fail(`compiled analytics export missing: ${name}`);
  }
  function render(name) {
    surface = name === "SmsVerification" ? "sms" : "payment";
    stateIndex = 0; refIndex = 0; effects.length = 0;
    context.__component = component(name); context.__pid = payment.id;
    if (surface === "payment" && states[2]) states[2].pid = payment.id;
    // Deliberately different from Payment.id: URL input cannot be the event ID.
    return execute('__component({pid:__pid,preRegistration:true})', context);
  }
  function form(node) {
    if (!node || typeof node !== "object") return null;
    if (node.type === "form" && typeof node.props.onSubmit === "function") return node.props.onSubmit;
    for (const child of Array.isArray(node) ? node : Object.values(node.props ?? {})) { const found = form(child); if (found) return found; }
    return null;
  }
  return {
    events, storage, session, polling, payment, window,
    report(input) { return exported("reportPurchaseComplete")({ userId: uuid, revenue: 1500, paymentId, ...input }); },
    remember(value = payment, result) { return exported("rememberPurchase")(value, value.id, uuid, result); },
    recover(value = payment, isActive = () => true) { return exported("recoverPurchases")({ getPayment: async () => ({ data: value }) }, uuid, null, isActive); },
    get touched() { return touched; }, get digestCalls() { return digestCalls; }, get wallet() { return wallet; },
    async sms() {
      const submit = form(render("SmsVerification"));
      if (submit) { context.__submit = submit; await execute('__submit({preventDefault(){}})', context); }
      return submit;
    },
    async repeatSms(submit) { if (submit) { context.__submit = submit; await execute('__submit({preventDefault(){}})', context); } },
    purchase() { render("PaymentThanks"); for (const effect of effects) { context.__effect = effect; execute("__effect()", context); } },
    async settle() { if (finish) { await finish(); await new Promise(resolve => setImmediate(resolve)); } },
  };
}

function assertPayload(run, event, mail, count = 1, id = paymentId) {
  assert.equal(run.events.length, count, `compiled ${event} count`);
  if (!count) return;
  const expected = { event, user_id: uuid };
  if (mail !== "missing" && mail !== "failure") expected.user_email = emailHash;
  if (event === "purchase_complete") { expected.revenue = 1500; expected.transaction_id = id; }
  assert.equal(JSON.stringify(run.events[count - 1]), JSON.stringify(expected), "unapproved event payload / raw email / wrong identity or revenue");
  assert(!JSON.stringify([...run.storage]).includes(emailHash), "email hash persisted");
  assert(!JSON.stringify([...run.storage]).includes("@"), "raw email persisted");
  for (const [key, value] of run.storage) {
    if (key === "oripoke:cv:purchase_pending:v1") {
      const rows = JSON.parse(value);
      assert(Array.isArray(rows) && rows.length <= 5);
      for (const row of rows) {
        assert.deepEqual(Object.keys(row).sort(), ["paymentId", "savedAt", "userId"]);
        assert.equal(row.userId, uuid);
        assert(Number.isSafeInteger(row.savedAt));
      }
      continue;
    }
    assert(!value.includes(uuid), "raw UUID in sent marker");
    assert.match(key, /^oripoke:cv:(?:registration_complete|purchase_complete):[a-z0-9]+$/);
    assert.equal(value, "1");
  }
}

export async function verifyClientChunks(chunks, state) {
  assert(chunks.length, "compiled analytics surfaces missing");
  // Reuse only completed behavioral checks for identical bytes and expected state.
  // Observation/manifest checksums are still recomputed by the caller every time.
  const fingerprint = createHash("sha256").update(JSON.stringify([state, chunks])).digest("hex");
  if (verifiedBytes.has(fingerprint)) return;
  const entries = [];
  const context = vm.createContext({ TURBOPACK: { push(chunk) {
    let ids = [];
    for (const part of chunk.slice(1)) {
      if (typeof part === "number") ids.push(part);
      else if (typeof part === "function") { for (const id of ids) entries.push({ id, factory: part }); ids = []; }
    }
  } } });
  for (const chunk of chunks) execute(chunk.code, context);
  const variants = entries.filter(entry => /oripoke:cv:|["'](?:SmsVerification|PaymentThanks)["']|exports\.(?:SmsVerification|PaymentThanks)/.test(entry.factory.toString()));
  assert(variants.length >= 2, "compiled SMS/payment modules missing");
  // Check each emitted variant, including duplicate module IDs in route chunks.
  for (const variant of variants) {
    const variantCode = variant.factory.toString();
    for (const runtimeId of ["", "GTM-TEST0001", "invalid"]) {
      if (/oripoke:cv:|SmsVerification/.test(variantCode)) for (const mode of ["initial", "failed", "unverified-result", "redisplay", "phone-change"]) {
        for (const mail of mode === "initial" ? ["normal", "fullwidth", "missing", "failure", "no-user"] : ["normal"]) {
          const run = runtime(chunks, variant, mode, mail, runtimeId);
          const submit = await run.sms();
          if (run.digestCalls) assert.equal(run.events.length, 0, "SMS analytics must await hashing");
          await run.repeatSms(submit);
          if (run.digestCalls) assert.equal(run.digestCalls, 1, "duplicate in-flight SMS hash");
          await run.settle(); await run.repeatSms(submit); await run.settle();
          const count = state.gtm_enabled && mode === "initial" && mail !== "no-user" ? 1 : 0;
          assertPayload(run, "registration_complete", mail, count);
          if (!state.gtm_enabled) { assert.equal(run.touched, 0); assert.equal(run.digestCalls, 0); }
        }
      }
      if (/oripoke:cv:|PaymentThanks/.test(variantCode)) for (const mode of ["succeeded", "created", "requires_action", "processing", "failed", "canceled", "expired", "loading", "invalid", "error", "delayed", "wrong-user", "wrong-amount", "wrong-id", "wrong-currency"]) {
        for (const mail of mode === "succeeded" ? ["normal", "fullwidth", "missing", "failure", "no-user"] : ["normal"]) {
          const run = runtime(chunks, variant, mode, mail, runtimeId);
          if (["loading", "invalid", "error", "delayed"].includes(mode)) { run.polling.status = mode; run.payment.status = "succeeded"; }
          if (mode.startsWith("wrong-")) run.payment.status = "succeeded";
          if (mode === "wrong-user") run.session.session.user.id = "invalid";
          if (mode === "wrong-id") run.payment.id = "invalid";
          if (mode === "wrong-amount") run.payment.amount.amount = 1.5;
          if (mode === "wrong-currency") run.payment.amount.currency = "USD";
          run.purchase(); run.purchase();
          if (run.digestCalls) { assert.equal(run.digestCalls, 1); assert.equal(run.storage.size, 0); assert.equal(run.events.length, 0); }
          await run.settle(); run.purchase(); await run.settle();
          const count = state.gtm_enabled && mode === "succeeded" && mail !== "no-user" ? 1 : 0;
          assertPayload(run, "purchase_complete", mail, count);
          if (count && mail === "normal") {
            const reload = runtime(chunks, variant, "succeeded", mail, runtimeId, false, run.storage);
            reload.purchase(); await reload.settle();
            assertPayload(reload, "purchase_complete", mail, 0);
          }
          if (!state.gtm_enabled) { assert.equal(run.touched, 0); assert.equal(run.digestCalls, 0); }
          if (mode === "succeeded") assert.equal(run.wallet, 1, "analytics blocked wallet refresh");
        }
      }
      const run = runtime(chunks, variant, "processing", "normal", runtimeId, true);
      run.purchase(); assert.equal(run.events.length, 0);
      run.payment.status = "succeeded"; run.purchase(); run.purchase(); await run.settle(); run.purchase(); await run.settle();
      assertPayload(run, "purchase_complete", "normal", state.gtm_enabled ? 1 : 0);
      const next = "00000000-0000-4000-9000-000000000002";
      run.payment.id = next; run.purchase(); await run.settle(); run.purchase(); await run.settle();
      assertPayload(run, "purchase_complete", "normal", state.gtm_enabled ? 2 : 0, next);
      const retry = runtime(chunks, variant, "succeeded", "normal", runtimeId);
      Object.defineProperty(retry.window, "dataLayer", { configurable: true, value: Object.freeze([]) });
      retry.purchase(); await retry.settle();
      assert(![...retry.storage.keys()].some(key => key.startsWith("oripoke:cv:purchase_complete:")), "failed push marked sent");
      Object.defineProperty(retry.window, "dataLayer", { configurable: true, get: () => retry.events });
      retry.purchase(); await retry.settle();
      assertPayload(retry, "purchase_complete", "normal", state.gtm_enabled ? 1 : 0);
    }
  }
  // Execute the emitted recovery helper, not a second source implementation.
  for (const mode of ["succeeded", "processing", "failed", "konbini", "virtual_account", "wrong-id", "logout"]) {
    const run = runtime(chunks, null, "processing", "missing", "invalid");
    await run.remember();
    run.payment.status = mode === "processing" ? "processing" : mode === "failed" ? "failed" : "succeeded";
    if (["konbini", "virtual_account"].includes(mode)) run.payment.method = mode;
    const response = mode === "wrong-id" ? { ...run.payment, id: "00000000-0000-4000-9000-000000000099" } : run.payment;
    await run.recover(response, () => mode !== "logout");
    assertPayload(run, "purchase_complete", "missing", state.gtm_enabled && mode === "succeeded" ? 1 : 0);
    if (state.gtm_enabled) {
      const pending = JSON.parse(run.storage.get("oripoke:cv:purchase_pending:v1") ?? "[]");
      assert.equal(pending.length, ["processing", "logout"].includes(mode) ? 1 : 0, `compiled recovery queue ${mode}`);
    } else assert.equal(run.touched, 0, "disabled compiled recovery touched browser I/O");
  }
  const held = new Set();
  const locks = { async request(name, options, action) {
    if (options.ifAvailable && held.has(name)) return action(null);
    held.add(name); try { return await action({}); } finally { held.delete(name); }
  } };
  const storage = new Map();
  const a = runtime(chunks, null, "succeeded", "missing", "invalid", false, storage, locks);
  const b = runtime(chunks, null, "succeeded", "missing", "invalid", false, storage, locks);
  const results = await Promise.all([a.report(), b.report()]);
  assert.equal(a.events.length + b.events.length, state.gtm_enabled ? 1 : 0, "compiled cross-tab exclusion");
  if (state.gtm_enabled) {
    assert(results.includes("pushed") && results.includes("in_progress"));
    assert.equal(await b.report(), "already_sent");
  } else assert(results.every(result => result === "not_applicable"));
  verifiedBytes.add(fingerprint);
}

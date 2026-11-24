import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import vm from "node:vm";

const userId = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
const token = "a".repeat(64), renewed = "b".repeat(64);
const email = "　ＭＥＭＢＥＲ＠ＥＸＡＭＰＬＥ．ＴＥＳＴ　";
const hash = value => createHash("sha256").update(value).digest("hex");
const key = "oripoke:cv:conversion:" + hash(id);
const evaluate = (code, context) => vm.runInContext(code, context, { timeout: 1000 });

// Run the actual emitted component and analytics factories. Only React hooks,
// official API I/O, browser storage/locks and time are replaced by isolated doubles.
function document(chunks, selected, options = {}) {
  const modules = new Map(), cache = new Map(), refs = [], effects = [], layouts = [];
  const storage = options.storage ?? new Map(), events = [], calls = [];
  let refIndex = 0, now = 100, touched = 0, hashes = 0, factoryCalls = 0;
  let selectedFactory;
  let session = { state: { status: "authenticated", session: { user: { id: userId, email } } }, smsAccess: "verified" };
  const api = {
    async pending() { calls.push(["pending"]); return options.pending ? options.pending(run) : [{ id, event: "line_friend_added" }]; },
    async claim(value) { calls.push(["claim", value]); assert.equal(events.length, 0, "push preceded claim"); return options.claim ? options.claim(run) : { token, expiresInSeconds: 120 }; },
    async delivered(value, claimToken) { calls.push(["delivered", value, claimToken]); return options.delivered ? options.delivered(run, claimToken) : "delivered"; },
  };
  const window = {};
  Object.defineProperties(window, {
    localStorage: { get() {
      touched++;
      if (options.storageDenied) throw Error("synthetic storage denial");
      return { getItem: k => storage.get(k), setItem: (k, value) => storage.set(k, value) };
    } },
    dataLayer: { configurable: true, get() { touched++; return events; } },
  });
  const context = vm.createContext({ window, TextEncoder, navigator: { locks: options.locks }, performance: { now: () => now },
    process: { env: { NEXT_PUBLIC_GTM_ID: options.runtimeId ?? "invalid" } },
    crypto: { subtle: { digest: async (algorithm, bytes) => {
      hashes++;
      assert.equal(algorithm, "SHA-256");
      if (options.onHash) options.onHash(run, Buffer.from(bytes).toString("utf8"));
      return webcrypto.subtle.digest(algorithm, bytes);
    } } },
    TURBOPACK: { push(chunk) {
      let ids = [];
      for (const part of chunk.slice(1)) {
        if (typeof part === "number") ids.push(part);
        else if (typeof part === "function") {
          for (const id of ids) {
            modules.set(id, part);
            if (selected?.id === id && selected.factory.toString() === part.toString()) selectedFactory = part;
          }
          ids = [];
        }
        else assert.fail("unsupported LINE compiled module registration");
      }
    } },
  });
  for (const chunk of chunks) evaluate(chunk.code, context);
  if (selected) { assert(selectedFactory, "compiled LINE variant missing"); modules.set(selected.id, selectedFactory); }
  const external = () => session;
  const namespace = new Proxy({
    useRef: initial => refs[refIndex++] ??= { current: initial },
    useEffect: callback => effects.push(callback), useLayoutEffect: callback => layouts.push(callback),
    useSession: () => session,
    createBrowserConversionClient: () => { factoryCalls++; return api; },
  }, { get: (target, name) => name in target ? target[name] : external });
  const analytics = factory => /oripoke:cv:|LineFriendConversionDelivery/.test(factory.toString());
  function load(id) {
    if (cache.has(id)) return cache.get(id);
    const factory = modules.get(id);
    if (!factory) return namespace;
    const exports = {}; cache.set(id, exports);
    const bridge = {
      i: imported => modules.has(imported) && analytics(modules.get(imported)) ? load(imported) : namespace,
      s: values => {
        for (let index = 0; index < values.length;) {
          const name = values[index++], value = values[index++];
          if (value === 0) exports[name] = values[index++];
          else Object.defineProperty(exports, name, { get: value });
        }
      },
    };
    context.__factory = factory; context.__bridge = bridge;
    evaluate("__factory(__bridge)", context);
    return exports;
  }
  let component;
  for (const [id, factory] of modules) {
    if (factory.toString().includes("LineFriendConversionDelivery")) component = load(id).LineFriendConversionDelivery ?? component;
  }
  assert.equal(typeof component, "function", "compiled LINE component missing");
  const run = {
    events, storage, calls, window, api,
    get touched() { return touched; }, get hashes() { return hashes; }, get factoryCalls() { return factoryCalls; },
    get now() { return now; }, set now(value) { now = value; },
    setSession(value) { session = value; },
    logout() { session = { state: { status: "anonymous" }, smsAccess: "unknown" }; run.render(); },
    changeUser() { session = { ...session, state: { status: "authenticated", session: { user: { id: "00000000-0000-4000-8000-000000000099", email } } } }; run.render(); },
    unverified() { session = { ...session, smsAccess: "unverified" }; },
    render() {
      refIndex = 0; effects.length = 0; layouts.length = 0;
      context.__component = component; context.__props = { api };
      evaluate("__component(__props)", context);
      for (const effect of [...layouts, ...effects]) { context.__effect = effect; evaluate("__effect()", context); }
    },
    async settle() { for (let i = 0; i < 12; i++) await new Promise(resolve => setTimeout(resolve, 1)); },
  };
  return run;
}

function payload(run, count) {
  assert.equal(run.events.length, count, "compiled LINE push count");
  if (count) assert.equal(JSON.stringify(run.events[0]), JSON.stringify({ event: "line_friend_added", user_id: userId, user_email: hash("member@example.test") }), "LINE payload contains unapproved fields / raw email / wrong member");
  for (const [storedKey, value] of run.storage) {
    assert.equal(storedKey, key, "LINE marker must use hashed record ID");
    assert(!value.includes(id) && !value.includes(userId) && !value.includes("@"), "LINE marker contains identity/PII");
  }
}

export async function verifyLineClientChunks(chunks, state) {
  const variants = [];
  const context = vm.createContext({ TURBOPACK: { push(chunk) {
    let ids = [];
    for (const part of chunk.slice(1)) {
      if (typeof part === "number") ids.push(part);
      else if (typeof part === "function") {
        if (/oripoke:cv:conversion:|LineFriendConversionDelivery/.test(part.toString())) for (const id of ids) variants.push({ id, factory: part });
        ids = [];
      }
    }
  } } });
  for (const chunk of chunks) evaluate(chunk.code, context);
  assert(variants.some(entry => entry.factory.toString().includes("LineFriendConversionDelivery")), "compiled LINE surface absent");
  for (const variant of variants) {
    for (const runtimeId of ["", "invalid", "GTM-TEST0001"]) {
      const run = document(chunks, variant, { runtimeId });
      run.render(); run.render(); await run.settle(); run.render(); await run.settle();
      payload(run, state.gtm_enabled ? 1 : 0);
      assert.equal(run.calls.filter(([name]) => name === "pending").length, state.gtm_enabled ? 1 : 0, "one attempt per document");
      assert.equal(run.calls.filter(([name]) => name === "delivered").length, state.gtm_enabled ? 1 : 0);
      if (!state.gtm_enabled) {
        assert.equal(run.touched, 0); assert.equal(run.hashes, 0); assert.equal(run.factoryCalls, 0);
      }
    }
    for (const condition of ["unauthenticated", "sms"]) {
      const run = document(chunks, variant);
      if (condition === "sms") run.unverified(); else run.logout();
      run.render(); await run.settle();
      assert.equal(run.calls.length, 0, `compiled LINE ${condition} called API`); payload(run, 0);
    }
    if (!state.gtm_enabled) continue;
    for (const result of ["held", "already_delivered", "not_deliverable", "not_found"]) {
      const run = document(chunks, variant, { claim: () => result });
      run.render(); await run.settle(); payload(run, 0);
      assert.equal(run.calls.filter(([name]) => name === "delivered").length, 0);
    }
    for (const boundary of ["claim", "hash", "logout", "change-user"]) {
      const run = document(chunks, variant, {
        claim: run => {
          if (boundary === "claim") run.now = 90_100;
          if (boundary === "logout") run.logout();
          if (boundary === "change-user") run.changeUser();
          return { token, expiresInSeconds: 120 };
        },
        onHash: (run, value) => { if (boundary === "hash" && value.includes("@")) run.now = 90_100; },
      });
      run.render(); await run.settle(); payload(run, 0);
      assert.equal(run.calls.filter(([name]) => name === "delivered").length, 0, `expired/invalid session ${boundary} confirmed`);
    }
    for (const failure of ["invalid", "throws"]) {
      const run = document(chunks, variant);
      Object.defineProperty(run.window, "dataLayer", { value: failure === "invalid" ? {} : Object.freeze([]) });
      run.render(); await run.settle(); payload(run, 0);
      assert.equal(run.storage.size, 0, "failed push marked sent");
      assert.equal(run.calls.filter(([name]) => name === "delivered").length, 0, "failed push confirmed");
      const revisit = document(chunks, variant, { storage: run.storage });
      revisit.render(); await revisit.settle(); payload(revisit, 1);
    }
    const denied = document(chunks, variant, { storageDenied: true });
    denied.render(); await denied.settle(); payload(denied, 1);
    assert.equal(denied.calls.filter(([name]) => name === "delivered").length, 1, "storage failure blocked confirmation");

    const first = document(chunks, variant, { delivered: () => { throw Error("offline"); } });
    first.render(); await first.settle(); payload(first, 1);
    assert.equal(JSON.parse(first.storage.get(key)).state, "pushed");
    const recovery = document(chunks, variant, { storage: first.storage, claim: () => ({ token: renewed, expiresInSeconds: 120 }), delivered: (run, value) => {
      if (value === token) return "token_mismatch";
      assert.equal(JSON.parse(run.storage.get(key)).token, renewed, "renewed token not saved before delivered");
      throw Error("still offline");
    } });
    recovery.render(); await recovery.settle(); payload(recovery, 0);
    assert.equal(JSON.parse(first.storage.get(key)).token, renewed);
    const final = document(chunks, variant, { storage: first.storage });
    final.render(); await final.settle(); payload(final, 0);
    assert.deepEqual(final.calls, [["pending"], ["delivered", id, renewed]], "recovery repeated push/claim");
    assert.equal(JSON.parse(first.storage.get(key)).state, "delivered");
    const revisit = document(chunks, variant, { storage: first.storage });
    revisit.render(); await revisit.settle(); payload(revisit, 0); assert.deepEqual(revisit.calls, [["pending"]]);
  }
  if (!state.gtm_enabled) return;
  // Actual record lock across two documents; a separate device has separate
  // storage/locks and must independently respect the server's held claim.
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const held = new Set();
  const locks = { async request(name, options, action) {
    assert.equal(options.ifAvailable, true);
    if (held.has(name)) return action(null);
    held.add(name); try { return await action({}); } finally { held.delete(name); }
  } };
  const storage = new Map();
  const owner = document(chunks, null, { storage, locks, claim: () => pending });
  owner.render(); await owner.settle();
  assert(owner.calls.some(([name]) => name === "claim"));
  const tab = document(chunks, null, { storage, locks });
  tab.render(); await tab.settle(); assert.deepEqual(tab.calls, [["pending"]]);
  const device = document(chunks, null, { claim: () => "held" });
  device.render(); await device.settle(); payload(device, 0);
  release({ token, expiresInSeconds: 120 }); await owner.settle();
  payload(owner, 1); payload(tab, 0);
}

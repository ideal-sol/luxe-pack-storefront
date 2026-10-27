import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const marker = "oripoke:cv:registration_complete:";
const observationPath = ".next/gtm-build-observation.json";
const sourceDigests = {
  "src/lib/analytics/gtm.ts": "f8f9beb8da3cbb8d07c28cf7ac087da3d4ff6bf94a4e4d55645155075b5bfa09",
  "src/components/analytics/google-tag-manager.tsx": "012e0bea04cbca46f943cd4f6146c90d0f2f359c7b1c16386e3f3ace979dc337",
  "src/components/account/sms-verification.tsx": "5da5c9bf36bfc78b9d95a4ee29fac1399b120c73bd58d19a1aae5e5fd32ca848",
  "src/app/layout.tsx": "f4e56f7a0695bd5a0773065be3a8989edcd3226836d1dbb268557263c837ca68",
  "next.config.ts": "d8440b8f51f07c4e4670ce361c05a7e4b259ba58660d5f39e286a8ba7796a9b5",
};

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function expectedState(id) {
  assert(typeof id === "string" && (id === "disabled" || /^GTM-[A-Z0-9]{4,12}$/.test(id)), "explicit valid GTM ID or disabled required");
  return { gtm_id: id === "disabled" ? null : id, gtm_enabled: id !== "disabled" };
}

export function validateSource(root) {
  // PR186 reviewed bytes: the existing PR179 Authority deliberately fails here.
  // A changed analytics/SMS composition requires a new focused review, never a fallback.
  for (const [path, digest] of Object.entries(sourceDigests)) {
    assert.equal(hash(readFileSync(join(root, path))), digest, `unreviewed GTM Source: ${path}`);
  }
}

function files(root, directory, extension) {
  return readdirSync(join(root, directory), { recursive: true }).filter(path => path.endsWith(extension))
    .sort().map(path => `${directory}/${path}`);
}

function evaluate(code, context = {}) {
  // No network, module loading, timers or browser execution. Only reviewed fragments.
  return vm.runInNewContext(code, context, { timeout: 1000 });
}

function functionAt(code, start) {
  assert(start >= 0, "compiled function missing");
  for (let end = code.indexOf("}", start); end >= 0; end = code.indexOf("}", end + 1)) {
    const fragment = code.slice(start, end + 1);
    try {
      new vm.Script(`(${fragment})`);
      return fragment;
    } catch { /* nested brace or string; keep the exact compiled bytes */ }
  }
  throw new Error("compiled function boundary missing");
}

function gateDeclaration(code, gateName) {
  const start = code.indexOf(`function ${gateName}()`);
  const gate = functionAt(code, start);
  // Capture the actual adjacent compiled ID validator, not a replacement predicate.
  const prefix = code.slice(Math.max(0, start - 200), start);
  const pattern = prefix.match(/(?:let|const|var) ([$\w]+)=\/\^GTM-\[A-Z0-9\]\{4,12\}\$\//);
  assert(pattern, "compiled ID validator missing");
  return `let ${pattern[1]}=/^GTM-[A-Z0-9]{4,12}$/;${gate}`;
}

async function verifySmsFragment(code, state) {
  const position = code.indexOf(marker);
  const start = code.lastIndexOf("function(", position);
  const report = functionAt(code, start);
  assert(report.includes(marker), "compiled registration helper missing");
  const gate = report.match(/if\(!([$\w]+)\(\)\|\|/);
  assert(gate, "compiled registration gate missing");
  const declaration = gateDeclaration(code, gate[1]);
  // Execute the actual initial-state predicate, awaited verification and event call.
  // This deliberately fails closed if the compiler or reviewed SMS hook changes shape.
  const prefix = code.slice(Math.max(0, start - 450), start);
  const flow = prefix.match(/let ([$\w]+)=!([$\w]+)\?\.verified&&!([$\w]+);try\{let ([$\w]+)=await ([$\w]+)\(\{challenge_id:([$\w]+)\.id,code:([$\w]+)\}\);\1&&\4\.verified&&$/);
  const user = code.slice(start + report.length).match(/^\(([$\w]+)\)/);
  assert(flow && user, "compiled initial SMS condition missing");
  const [, initial, status, changing, result, verify, challenge, otp] = flow;
  const fragment = `let ${initial}=!${status}?.verified&&!${changing};let ${result}=await ${verify}({challenge_id:${challenge}.id,code:${otp}});${initial}&&${result}.verified&&(${report})(${user[1]});`;
  for (const runtimeId of ["", "GTM-TEST0001", "invalid"]) {
    for (const mode of ["initial", "failed", "unverified-result", "redisplay", "phone-change"]) {
      const events = [];
      const storage = new Map();
      let touched = 0;
      const window = {};
      Object.defineProperties(window, {
        dataLayer: { get() { touched++; return events; } },
        localStorage: { get() { touched++; return { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }; } },
      });
      const context = {
        window, process: { env: { NEXT_PUBLIC_GTM_ID: runtimeId } },
        [status]: { verified: mode === "redisplay" }, [changing]: mode === "phone-change",
        [challenge]: { id: "synthetic-challenge" }, [otp]: "000000", [user[1]]: "synthetic-user",
        [verify]: async () => {
          if (mode === "failed") throw new Error("synthetic SMS failure");
          return { verified: mode !== "unverified-result" };
        },
      };
      const invoke = () => evaluate(`(async()=>{${declaration}${fragment}})()`, context);
      if (mode === "failed") await assert.rejects(invoke, /synthetic SMS failure/);
      else { await invoke(); await invoke(); }
      const count = state.gtm_enabled && mode === "initial" ? 1 : 0;
      assert.equal(events.length, count, `compiled SMS event mismatch: ${mode}`);
      for (const event of events) assert.equal(JSON.stringify(event), '{"event":"registration_complete"}', "PII in event payload");
      if (!state.gtm_enabled) assert.equal(touched, 0, "disabled build accessed analytics");
    }
  }
}

function verifyHtml(html, state) {
  const flight = [];
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (match[1].startsWith("self.__next_f.push(")) evaluate(match[1], { self: { __next_f: { push: value => flight.push(value) } } });
  }
  const payload = flight.filter(value => value[0] === 1).map(value => value[1]).join("");
  const scripts = [...payload.matchAll(/"id":"google-tag-manager","strategy":"afterInteractive","children":("(?:\\.|[^"\\])*")/g)];
  const frames = [...html.matchAll(/<iframe\b[^>]*src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=([^"&]+)"[^>]*>/g)];
  if (!state.gtm_enabled) {
    assert.equal(scripts.length, 0, "loader in disabled build");
    assert.equal(frames.length, 0, "iframe in disabled build");
    assert(!html.includes("googletagmanager.com") && !html.includes("google-tag-manager"), "GTM tag in disabled HTML");
    return;
  }
  assert.equal(scripts.length, 1, "exactly one built loader required");
  assert.equal(frames.length, 1, "exactly one built iframe required");
  assert.equal(frames[0][1], state.gtm_id, "built iframe ID mismatch");
  assert(html.includes(`<noscript>${frames[0][0]}</iframe></noscript>`), "iframe must be inside noscript");
  const inserted = [];
  const window = {};
  const document = {
    getElementsByTagName: () => [{ parentNode: { insertBefore: element => inserted.push(element) } }],
    createElement: () => ({}),
  };
  evaluate(JSON.parse(scripts[0][1]), { window, document });
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].src, `https://www.googletagmanager.com/gtm.js?id=${state.gtm_id}`, "built loader ID mismatch");
  assert.equal(inserted[0].async, true);
  assert.equal(window.dataLayer.length, 1);
  assert.equal(window.dataLayer[0].event, "gtm.js");
}

export async function observe(root, id) {
  const state = expectedState(id);
  const required = JSON.parse(readFileSync(join(root, ".next/required-server-files.json"), "utf8"));
  const input = required.config?.env?.NEXT_PUBLIC_GTM_ID;
  assert.equal(input, state.gtm_id ?? "", "compiled config GTM mismatch");
  const checked = [".next/required-server-files.json", ".next/BUILD_ID"];
  const htmlPaths = files(root, ".next/server/app", ".html");
  assert(htmlPaths.includes(".next/server/app/contact.html"), "shared root prerender missing");
  for (const path of htmlPaths) {
    // Next's global error document intentionally bypasses the application layout.
    verifyHtml(readFileSync(join(root, path), "utf8"), path.endsWith("/_global-error.html") ? expectedState("disabled") : state);
    checked.push(path);
  }
  let smsChunks = 0;
  let serverGates = 0;
  for (const surface of [".next/static", ".next/server"]) {
    for (const path of files(root, surface, ".js")) {
      const code = readFileSync(join(root, path), "utf8");
      if (code.includes("NEXT_PUBLIC_GTM_ID")) {
        assert(!/process\.env(?:\.NEXT_PUBLIC_GTM_ID|\[["']NEXT_PUBLIC_GTM_ID["']\])/.test(code), "runtime GTM lookup in compiled code");
      }
      if (surface === ".next/static" && code.includes(marker)) {
        await verifySmsFragment(code, state);
        checked.push(path);
        smsChunks++;
      }
      if (surface === ".next/server" && code.includes("google-tag-manager") && code.includes("/^GTM-[A-Z0-9]{4,12}$/")) {
        const match = code.match(/function ([$\w]+)\(\)\{let ([$\w]+)=(?:"[^"\n]*"|'[^'\n]*')\.trim\(\)/);
        assert(match, "frozen server GTM gate missing");
        const declaration = gateDeclaration(code, match[1]);
        for (const runtimeId of ["", "GTM-TEST0001", "invalid"]) {
          assert.equal(evaluate(`${declaration};${match[1]}()`, { process: { env: { NEXT_PUBLIC_GTM_ID: runtimeId } } }), state.gtm_id);
        }
        checked.push(path);
        serverGates++;
      }
    }
  }
  assert(smsChunks >= 1, "compiled SMS behavior missing");
  assert(serverGates >= 1, "compiled server GTM behavior missing");
  return {
    schema_version: "1.0", ...state,
    build_id: readFileSync(join(root, ".next/BUILD_ID"), "utf8").trim(),
    files: Object.fromEntries([...new Set(checked)].sort().map(path => [path, hash(readFileSync(join(root, path)))])),
  };
}

export async function verifyRelease(root, id) {
  const state = expectedState(id);
  const manifest = JSON.parse(readFileSync(join(root, "artifact-manifest.json"), "utf8"));
  for (const key of ["gtm_id", "gtm_enabled"]) assert.equal(manifest[key], state[key], `manifest ${key} mismatch`);
  assert.equal(manifest.build_id, readFileSync(join(root, ".next/BUILD_ID"), "utf8").trim(), "manifest build_id mismatch");
  assert.equal(manifest.gtm_observation_sha256, hash(readFileSync(join(root, observationPath))), "manifest GTM observation hash mismatch");
  const observation = await observe(root, id);
  const recorded = JSON.parse(readFileSync(join(root, observationPath), "utf8"));
  assert.deepEqual(observation, recorded, "GTM observed bytes changed");
  for (const key of ["gtm_id", "gtm_enabled", "build_id"]) assert.equal(manifest[key], observation[key], `manifest ${key} mismatch`);
  return observation;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, root, id] = process.argv.slice(2);
  if (command === "source") validateSource(root);
  else if (command === "observe") writeFileSync(join(root, observationPath), `${JSON.stringify(await observe(root, id), null, 2)}\n`);
  else if (command === "verify") await verifyRelease(root, id);
  else throw new Error("invalid GTM verification command");
  console.log(`GTM ${command} verified`);
}

// @vitest-environment node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { expectedState, observe, validateSource, verifyRelease } from "../../scripts/verify-gtm-build.mjs";
import { verifyClientChunks } from "../../scripts/verify-gtm-client.mjs";

const require = createRequire(import.meta.url);
const { minify, loadBindings } = require("next/dist/build/swc");
await loadBindings();
const roots = [];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function temporary() {
  const root = mkdtempSync(join(tmpdir(), "gtm-build-test-"));
  roots.push(root);
  return root;
}
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

// Compile the actual reviewed helper and SMS component, never a parallel event implementation.
async function fixture(id = "GTM-TEST0001") {
  const root = temporary();
  for (const dir of [".next/server/app", ".next/static/chunks", ".next/server/chunks"]) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, ".next/BUILD_ID"), "synthetic-build\n");
  writeFileSync(join(root, ".next/required-server-files.json"), JSON.stringify({ config: { env: { NEXT_PUBLIC_GTM_ID: id } } }));
  const gate = `let o=/^GTM-[A-Z0-9]{4,12}$/;function u(){let e=${JSON.stringify(id)}.trim()??"";return o.test(e)?e:null}`;
  for (const [index, file, name] of [[1, "src/lib/analytics/gtm.ts", "analytics"], [2, "src/components/account/sms-verification.tsx", "sms"], [3, "src/components/payment/payment-thanks.tsx", "purchase"]]) {
    const source = readFileSync(file, "utf8").replaceAll("process.env.NEXT_PUBLIC_GTM_ID", JSON.stringify(id));
    const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const compiled = await minify(javascript, { compress: true, mangle: false });
    const wrapper = `(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["fixture",${index},bridge=>{const exports={};const require=name=>bridge.i(name==="@/lib/analytics/gtm"?1:99);${compiled.code};bridge.s(Object.entries(exports).flatMap(([name,value])=>[name,0,value]));}]);`;
    writeFileSync(join(root, `.next/static/chunks/${name}.js`), wrapper);
  }
  writeFileSync(join(root, ".next/server/chunks/layout.js"), `${gate};"google-tag-manager";`);
  const loader = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer','${id}');`;
  const payload = id ? JSON.stringify({ id: "google-tag-manager", strategy: "afterInteractive", children: loader }) : "";
  writeFileSync(join(root, ".next/server/app/contact.html"), `${id ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}"></iframe></noscript>` : ""}<script>self.__next_f.push(${JSON.stringify([1, payload])})</script>`);
  return root;
}

async function release(root, id = "GTM-TEST0001") {
  const result = await observe(root, id);
  const bytes = `${JSON.stringify(result, null, 2)}\n`;
  writeFileSync(join(root, ".next/gtm-build-observation.json"), bytes);
  writeFileSync(join(root, "artifact-manifest.json"), JSON.stringify({
    gtm_id: result.gtm_id, gtm_enabled: result.gtm_enabled, build_id: result.build_id,
    gtm_observation_sha256: hash(bytes),
  }));
}

function replace(root, file, before, after) {
  const path = join(root, file);
  const content = readFileSync(path, "utf8");
  if (typeof before === "string") expect(content).toContain(before);
  else expect(content).toMatch(before);
  writeFileSync(path, content.replaceAll(before, after));
}

describe("GTM artifact byte authority", () => {
  it.each([undefined, "", "bad", " GTM-TEST0001", "GTM-test0001", "GTM-TEST0001\n"])("rejects absent or malformed expected ID: %j", value => {
    expect(() => expectedState(value)).toThrow();
  });

  it.each(["GTM-TEST0001", "disabled"])("executes loader, iframe, SMS/payment gates and poisoned runtime ENV: %s", async id => {
    const root = await fixture(id === "disabled" ? "" : id);
    await release(root, id);
    expect(await verifyRelease(root, id)).toMatchObject(expectedState(id));
    const result = spawnSync(process.execPath, ["scripts/verify-gtm-build.mjs", "verify", root, id], {
      env: { ...process.env, NEXT_PUBLIC_GTM_ID: "invalid" }, encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  }, 30_000); // Both expanded compiled surfaces, including a fresh independent CLI.

  it.each([
    [".next/server/app/contact.html", "GTM-TEST0001", "GTM-OTHER001"],
    [".next/server/app/contact.html", "ns.html?id=", "wrong.html?id="],
    [".next/static/chunks/sms.js", '!status?.verified&&!changingPhone', '!status?.verified'],
    [".next/static/chunks/analytics.js", 'event:event.event', 'event:event.event,email:"synthetic@example.test"'],
    [".next/static/chunks/analytics.js", '"GTM-TEST0001".trim()', 'process.env.NEXT_PUBLIC_GTM_ID.trim()'],
    [".next/server/chunks/layout.js", '"GTM-TEST0001".trim()', '"GTM-OTHER001".trim()'],
  ])("rejects altered built behavior: %s / %s", async (file, before, after) => {
    const root = await fixture();
    await release(root);
    replace(root, file, before, after);
    await expect(observe(root, "GTM-TEST0001")).rejects.toThrow();
    await expect(verifyRelease(root, "GTM-TEST0001")).rejects.toThrow();
  });

  it.each([
    ['user_email:event.user_email', 'user_email:"synthetic@example.test"'],
    ['.normalize("NFKC")', '.normalize("NFC")'],
    ['.toLowerCase()', '.toUpperCase()'],
    ['padStart(2,"0")', 'padStart(2,"A")'],
  ])("rejects unsafe compiled email behavior before recording observations: %s", async (before, after) => {
    const root = await fixture();
    replace(root, ".next/static/chunks/analytics.js", before, after);
    await expect(observe(root, "GTM-TEST0001")).rejects.toThrow();
  });

  it.each([
    ["purchase", '"succeeded"!==polling.payment.status', '"processing"!==polling.payment.status'],
    ["purchase", 'userId:session.session.user?.id??null', 'userId:"00000000-0000-4000-8000-000000000099"'],
    ["purchase", 'revenue:polling.payment.amount.amount', 'revenue:polling.payment.grant.total_points'],
    ["purchase", 'paymentId:polling.payment.id', 'paymentId:pid'],
    ["analytics", 'purchaseInFlight.has(paymentId)||purchaseSent.has(paymentId)', 'false'],
    ["analytics", 'purchaseSent.has(paymentId)', 'false'],
    ["analytics", 'if("1"===window.localStorage.getItem(key))return', 'if(false)return'],
    ["analytics", 'target.dataLayer.push({', 'target.dataLayer.push({event:"purchase_complete"}),target.dataLayer.push({'],
  ])("rejects unsafe compiled purchase composition %s / %s", async (file, before, after) => {
    const root = await fixture();
    replace(root, `.next/static/chunks/${file}.js`, before, after);
    await expect(observe(root, "GTM-TEST0001")).rejects.toThrow();
  }, 30_000);

  it("rejects removed analytics gates in an actually disabled compiled build", async () => {
    const root = await fixture("");
    replace(root, ".next/static/chunks/analytics.js", "!gtmContainerId()", "false");
    await expect(observe(root, "disabled")).rejects.toThrow();
  }, 30_000);

  it("executes invalid compiled GTM as disabled and rejects its invalid artifact config", async () => {
    const root = await fixture("invalid");
    await verifyClientChunks(["analytics", "sms", "purchase"].map(name => ({ path: `.next/static/chunks/${name}.js`, code: readFileSync(join(root, `.next/static/chunks/${name}.js`), "utf8") })), expectedState("disabled"));
    await expect(observe(root, "disabled")).rejects.toThrow("compiled config GTM mismatch");
  }, 30_000);

  it("rejects tags injected into a disabled build", async () => {
    const root = await fixture("");
    await release(root, "disabled");
    writeFileSync(join(root, ".next/server/app/contact.html"), '<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TEST0001"></iframe>');
    await expect(verifyRelease(root, "disabled")).rejects.toThrow();
  });

  it.each(["gtm_id", "gtm_enabled", "build_id", "gtm_observation_sha256"])("rejects missing/mismatched manifest %s", async key => {
    const root = await fixture();
    await release(root);
    const path = join(root, "artifact-manifest.json");
    const original = JSON.parse(readFileSync(path, "utf8"));
    for (const value of [undefined, "mismatch", false, null]) {
      writeFileSync(path, JSON.stringify({ ...original, [key]: value }));
      await expect(verifyRelease(root, "GTM-TEST0001")).rejects.toThrow();
    }
  });

  it("recomputes observations after package, extract and independent copy; refuses tampering", async () => {
    const root = await fixture();
    await release(root);
    const archive = join(temporary(), "isolated.tar.gz");
    execFileSync("tar", ["-czf", archive, "-C", root, "."]);
    const expectedHash = hash(readFileSync(archive));
    const downloaded = join(temporary(), "copy.tar.gz");
    cpSync(archive, downloaded);
    expect(hash(readFileSync(downloaded))).toBe(expectedHash);
    for (const file of [archive, downloaded]) {
      const extracted = temporary();
      execFileSync("tar", ["-xzf", file, "-C", extracted]);
      expect(await verifyRelease(extracted, "GTM-TEST0001")).toEqual(await verifyRelease(root, "GTM-TEST0001"));
      replace(extracted, ".next/BUILD_ID", "synthetic-build", "tampered-build");
      await expect(verifyRelease(extracted, "GTM-TEST0001")).rejects.toThrow();
    }
  });

  it("accepts only the reviewed registration attributes composition", () => {
    validateSource(".");
    const root = temporary();
    expect(() => validateSource(root)).toThrow();
  });
});

describe("production-only workflow wiring", () => {
  const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");
  const steps = workflow.split("      - name:");
  it("sets the real GTM build input on the one approved Build step", () => {
    expect(workflow.match(/NEXT_PUBLIC_GTM_ID:/g)).toHaveLength(1);
    expect(steps.find(step => step.startsWith(" Build exact production application"))).toContain("NEXT_PUBLIC_GTM_ID: GTM-5DQRPNN2");
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).not.toContain("GTM-5DQRPNN2");
  });
  it("verifies actual bytes before tar, after extraction and after exact-ID/digest-checked download", () => {
    expect(workflow).toContain('verify-gtm-build.mjs" source .');
    expect(workflow).toContain('verify-gtm-build.mjs" observe . GTM-5DQRPNN2');
    expect(steps.find(step => step.startsWith(" Package filesystem release"))).toContain('verify-gtm-build.mjs" verify "$release_root" GTM-5DQRPNN2');
    for (const name of ["Verify package before publication", "Verify re-download and ARM64 runtime"]) {
      expect(steps.find(step => step.startsWith(` ${name}`))).toContain('verify-gtm-build.mjs" verify . GTM-5DQRPNN2');
    }
    expect(workflow).toContain("artifact-ids: ${{ steps.upload.outputs.artifact-id }}");
    expect(workflow).toContain("digest-mismatch: error");
    expect(workflow).toContain("overwrite: false");
  });
});

import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const validator = resolve("scripts/verify-vendored-artifacts.mjs");
const current = "vendor/oripa/PAYMENT-PENDING-NOTICE-20261125";
let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "paidy-alpha53-artifact-"));
  cpSync("vendor", join(root, "vendor"), { recursive: true });
  for (const file of ["package.json", "pnpm-lock.yaml"]) cpSync(file, join(root, file));
});
afterEach(() => rmSync(root, { force: true, recursive: true }));

function verify() {
  return execFileSync(process.execPath, [validator], { cwd: root, encoding: "utf8", stdio: "pipe" });
}

describe("formal alpha.56 Source Artifact boundary", () => {
  it("accepts exact official bytes, runtime/header version and retained history", () => {
    expect(verify()).toContain("artifact-check: passed");
  });
  it.each(["artifact-manifest.json", "SHA256SUMS", "public.openapi.json",
    "oripa-storefront-client-2.0.0-alpha.56.tgz", "oripa-storefront-testkit-2.0.0-alpha.56.tgz"])("rejects modified %s", file => {
    appendFileSync(join(root, current, file), "tampered");
    expect(verify).toThrow(/Artifact digest mismatch/);
  });
  it("rejects an undefined file in the published bundle", () => {
    writeFileSync(join(root, current, "extra.json"), "{}");
    expect(verify).toThrow(/Artifact inventory mismatch/);
  });
  it("rejects changes to retained alpha.51 evidence", () => {
    appendFileSync(join(root, "vendor/oripa/PAIDY-ALPHA51-20261106/artifact-manifest.json"), " ");
    expect(verify).toThrow(/Retained alpha.51 digest mismatch/);
  });
  it("rejects changes to retained alpha.52 evidence", () => {
    appendFileSync(join(root, "vendor/oripa/LINE-ALPHA52-20261110/artifact-manifest.json"), " ");
    expect(verify).toThrow(/Retained alpha.52 digest mismatch/);
  });
  it("rejects changes to retained alpha.53 evidence", () => {
    appendFileSync(join(root, "vendor/oripa/PAIDY-20261124/artifact-manifest.json"), " ");
    expect(verify).toThrow(/Retained alpha.53 digest mismatch/);
  });
  it("rejects changes to retained alpha.54 evidence", () => {
    appendFileSync(join(root, "vendor/oripa/LINE-FRIEND-CV-20261120/artifact-manifest.json"), " ");
    expect(verify).toThrow(/Retained alpha.54 digest mismatch/);
  });
  it("rejects changes to retained alpha.55 evidence", () => {
    appendFileSync(join(root, "vendor/oripa/STRIPE-CARD-20261125/artifact-manifest.json"), " ");
    expect(verify).toThrow(/Retained alpha.55 digest mismatch/);
  });
  it("rejects changes to retained alpha.50 evidence", () => {
    appendFileSync(join(root, "vendor/oripa/EXCHANGEONLY-ALPHA50-20261104/artifact-manifest.json"), " ");
    expect(verify).toThrow(/Retained alpha.50 digest mismatch/);
  });
  it.each(["package.json", "pnpm-lock.yaml"])("rejects mixed Client/Testkit versions in %s", file => {
    const path = join(root, file);
    writeFileSync(path, readFileSync(path, "utf8").replaceAll("oripa-storefront-testkit-2.0.0-alpha.56.tgz", "oripa-storefront-testkit-2.0.0-alpha.50.tgz"));
    expect(verify).toThrow(/Canonical package pin|Obsolete Production package pin|exact pin mismatch/);
  });
});

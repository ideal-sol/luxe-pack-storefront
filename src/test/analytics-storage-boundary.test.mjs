import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const reviewedStorage = readFileSync("scripts/reviewed-analytics-storage.mjs", "utf8");
const approvedPaths = ["src/lib/analytics/gtm.ts", "src/test/analytics-gtm.test.tsx", "src/test/sms-verification-ui.test.tsx"];
const approved = Object.fromEntries(approvedPaths.map(path => [path, readFileSync(path, "utf8")]));

function check(checker, files) {
  const root = mkdtempSync(join(tmpdir(), "site-gtm-boundary-"));
  try {
    writeFileSync(join(root, "checker.mjs"), checker);
    writeFileSync(join(root, "reviewed-analytics-storage.mjs"), reviewedStorage);
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), source);
    }
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["add", "src"], { cwd: root });
    return spawnSync(process.execPath, ["checker.mjs"], { cwd: root, encoding: "utf8" });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

describe.each([
  ["Auth", "scripts/check-auth-boundary.mjs", "auth-storage"],
  ["LINE Identity", "scripts/check-line-identity-boundary.mjs", "identity-storage"],
])("reviewed analytics storage boundary: %s", (_name, path, forbidden) => {
  const checker = readFileSync(path, "utf8");
  it("accepts only the exact reviewed analytics helper and focused tests", () => {
    expect(check(checker, approved).status).toBe(0);
  });

  it.each(approvedPaths)("rejects a new arbitrary storage write in reviewed path %s", path => {
    const result = check(checker, { ...approved, [path]: approved[path] + '\nwindow.localStorage.setItem("auth-session", "fixture-only");\n' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(path + ":analytics-storage-review");
  });

  it.each(["src/components/auth/new-form.tsx", "src/lib/platform/session-cache.ts", "src/lib/analytics/unreviewed.ts"])(
    "keeps arbitrary storage forbidden in %s", path => {
      const result = check(checker, { ...approved, [path]: 'window.localStorage.setItem("auth-session", "fixture-only");' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(path + ":" + forbidden);
    },
  );

  it("retains direct API and browser-protocol rejection even for reviewed paths", () => {
    const path = approvedPaths[0];
    const result = check(checker, { ...approved, [path]: approved[path] + '\nconst api = "/api' + '/v2"; const cookie = "__Host-' + 'oripa_user";\n' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(path + ":direct-api");
    expect(result.stderr).toContain(path + ":browser-protocol");
  });
});

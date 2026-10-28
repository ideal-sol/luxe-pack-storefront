// @vitest-environment node
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

it.each([
  ["src/components/payment/provider-payment-sdk.ts", '\nfetch("https://evil.test");', "payment"],
  ["src/lib/platform/payment-ui-gateway.ts", '\ntransport.request({path: "/payments"});', "payment"],
  ["src/components/payment/provider-payment-actions.ts", '\nsessionStorage.setItem("payment", "raw");', "payment"],
  ["src/components/payment/payment-attempt.ts", '\nconst email = "private";', "payment"],
  ["src/components/payment/payment-attempt.ts", '\nsessionStorage.setItem("credential", "forbidden");', "auth"],
  ["src/test/payment-provider-actions.test.ts", '\n// requires renewed review', "auth"],
  ["src/components/payment/payment-attempt.ts", '\nsessionStorage.setItem("credential", "forbidden");', "line-identity"],
  ["src/test/payment-provider-ui.test.tsx", '\n// requires renewed review', "line-identity"],
])("keeps the real boundary gate rejecting unsafe mutation in %s (%s / %s)", (path, mutation, gate) => {
  const root = mkdtempSync(join(tmpdir(), "payment-ui-boundary-"));
  try {
    cpSync("src", join(root, "src"), { recursive: true });
    cpSync("scripts", join(root, "scripts"), { recursive: true });
    if (gate !== "payment") {
      execFileSync("git", ["init", "--quiet"], { cwd: root, stdio: "pipe" });
      execFileSync("git", ["add", "src"], { cwd: root, stdio: "pipe" });
    }
    const script = `scripts/check-${gate}-boundary.mjs`;
    execFileSync(process.execPath, [script], { cwd: root, stdio: "pipe" });
    writeFileSync(join(root, path), readFileSync(join(root, path), "utf8") + mutation);
    expect(() => execFileSync(process.execPath, [script], { cwd: root, stdio: "pipe" })).toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

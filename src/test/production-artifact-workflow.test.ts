import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");
const apiBase = "/api" + "/v2";
const validation = workflow.match(
  /- name: Validate production site URL\n[\s\S]*?node --input-type=module <<'NODE'\n([\s\S]*?)\n          NODE/,
)?.[1];

function validate(value?: string) {
  const env = { ...process.env };
  delete env.NEXT_PUBLIC_SITE_URL;
  if (value !== undefined) env.NEXT_PUBLIC_SITE_URL = value;
  return spawnSync(process.execPath, ["--input-type=module"], {
    input: validation,
    encoding: "utf8",
    env,
  });
}

describe("production artifact site URL authority", () => {
  it("requires an explicit non-secret input without a domain default", () => {
    expect(workflow).toMatch(/site_url:\n\s+description:.*\n\s+required: true\n\s+type: string/);
    expect(workflow).toContain("NEXT_PUBLIC_SITE_URL: ${{ inputs.site_url }}");
    expect(workflow).not.toMatch(/\bdefault:/);
    expect(validation).toBeTruthy();
    expect(validation).not.toContain("${{");
    expect(workflow).toContain("site_url: process.env.NEXT_PUBLIC_SITE_URL");
    expect(workflow).toContain(`NEXT_PUBLIC_PLATFORM_API_BASE_URL: ${apiBase}`);
  });

  it.each(["https://example.com", "https://shop.example.org", "https://example.com:8443"])(
    "accepts canonical HTTPS origin %s without a brand allowlist", (value) => {
      expect(validation).toBeTruthy();
      expect(validate(value).status).toBe(0);
    },
  );

  it.each([
    undefined, "", " ", "example.com", apiBase, "http://example.com",
    "https://", "https://example.com/", "https://example.com/path",
    "https://example.com?x=1", "https://example.com#fragment",
    "https://example.com?", "https://example.com#",
    "https://user:password@example.com", "https://@example.com",
    " https://example.com", "https://example.com\n", "https://exam\tple.com",
    "HTTPS://example.com", "https://EXAMPLE.com", "https://example.com:443",
    "https:example.com", "https://example.com\\path",
    "https://example.com/..", "https://%65xample.com",
    "$(touch /tmp/invalid-site-url)", "https://example.com; echo injected",
  ])("rejects non-origin or non-canonical input %j", (value) => {
    expect(validation).toBeTruthy();
    expect(validate(value).status).not.toBe(0);
  });
});

const appNameValidation = workflow.match(
  /- name: Validate production app name\n[\s\S]*?node --input-type=module <<'NODE'\n([\s\S]*?)\n          NODE/,
)?.[1];
const manifestScript = workflow.match(
  /node --input-type=module <<'NODE'\n(          import \{ writeFileSync, readFileSync \}[\s\S]*?)\n          NODE/,
)?.[1];

function validateAppName(value?: string) {
  const env = { ...process.env };
  delete env.NEXT_PUBLIC_APP_NAME;
  if (value !== undefined) env.NEXT_PUBLIC_APP_NAME = value;
  return spawnSync(process.execPath, ["--input-type=module"], {
    input: appNameValidation,
    encoding: "utf8",
    env,
  });
}

describe("production artifact application name authority", () => {
  it("uses a required non-secret dispatch input for the build and validates before building", () => {
    expect(workflow).toMatch(/app_name:\n\s+description:.*\n\s+required: true\n\s+type: string/);
    expect(workflow).toContain("NEXT_PUBLIC_APP_NAME: ${{ inputs.app_name }}");
    expect(workflow).not.toMatch(/(?:vars|secrets)\./);
    expect(appNameValidation).toBeTruthy();
    expect(appNameValidation).not.toContain("${{");
    expect(workflow.indexOf("- name: Validate production app name"))
      .toBeLessThan(workflow.indexOf("- name: Set up exact pnpm and frozen dependencies"));
    expect(workflow.indexOf("- name: Validate production app name"))
      .toBeLessThan(workflow.indexOf("- name: Build exact production application"));
    const build = workflow.match(/- name: Build exact production application([\s\S]*?)(?=      - name:)/)?.[1];
    expect(build).toContain("pnpm build");
    expect(build).not.toContain("env:");
    expect(workflow).toContain('echo "- NEXT_PUBLIC_APP_NAME: $NEXT_PUBLIC_APP_NAME"');
  });

  it.each([undefined, "", " ", "\t\n"])("fails closed for missing or blank name %j", (value) => {
    expect(appNameValidation).toBeTruthy();
    const result = validateAppName(value);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("NEXT_PUBLIC_APP_NAME is required");
  });

  it.each(["オリポケ", "Another Store", 'Store "A" & B', "$(false); `false`"])(
    "preserves the exact public value %j in existing manifest metadata", (appName) => {
      expect(appNameValidation).toBeTruthy();
      expect(validateAppName(appName).status).toBe(0);
      expect(manifestScript).toBeTruthy();
      const root = mkdtempSync(join(tmpdir(), "storefront-app-name-"));
      try {
        mkdirSync(join(root, "storefront-release"));
        const env = { ...process.env };
        for (const name of [
          "BUILD_ID", "BUILD_UTC", "CLIENT_PIN", "FILE_MANIFEST_SHA", "GIT_TREE",
          "NEXT_VERSION_ACTUAL", "NODE_VERSION", "PNPM_VERSION", "PUBLIC_OPENAPI_PIN",
          "SOURCE_SHA", "TESTKIT_PIN", "WORKFLOW_SHA",
        ]) env[name] = `fixture-${name}`;
        Object.assign(env, {
          SOURCE_SHA: "b85afec9aba0e72732366e8e12701cef39a06e06",
          WORKFLOW_SHA: "b".repeat(40),
          RUNNER_TEMP: root, NEXT_PUBLIC_APP_NAME: appName,
          NEXT_PUBLIC_SITE_URL: "https://example.com", NEXT_PUBLIC_PLATFORM_API_BASE_URL: apiBase,
        });
        const provenance = {
          source_sha: env.SOURCE_SHA, contract_version: "2.0.0-alpha.40", contract_artifact_id: "10845475225",
          contract_manifest_sha256: "5fba7399e21cff0226e9ae43a9a3fa73dc7c61a0716ce00787b0f4b931778a59",
          contract_manifest_path: "vendor/oripa/DRAW-20260925/artifact-manifest.json",
          platform_runtime_source_sha: "e4361ece51fc1249a5cfb2c64cf56d3aa4bb0c29",
          platform_authority_merge_sha: "d823c2f80c1500990289b06da8e5504d7b48c2e5",
          contract_archive_sha256: "3c5b35542cdaf7ed636aa0e7376e39d96463115ea14600c293d30d011e70b0e9",
          platform_source_sha: "dadf79f3b0b2409a57e41b10a83c7b6570ea3507",
          client_pin: "2.0.0-alpha.40", testkit_pin: "2.0.0-alpha.40", public_openapi_pin: "2.0.0-alpha.36",
          client_sha256: "724ff53616a5c05fd73a0570fd2c1455fc762a64bfa9936e61b73131ed5d2d99",
          testkit_sha256: "555705b61664116144da8b7ea3a87dca1ff0066e4b027bdbba87e2e7750b052e",
          public_openapi_sha256: "b469064b322d99b125995031aadfe765907651e014c003ccc82997a91843cd23",
        };
        writeFileSync(join(root, "contract-provenance.json"), JSON.stringify(provenance));
        const result = spawnSync(process.execPath, ["--input-type=module"], {
          input: manifestScript, encoding: "utf8", env,
        });
        expect(result.stderr).toBe("");
        expect(result.status).toBe(0);
        const manifest = JSON.parse(readFileSync(join(root, "storefront-release", "artifact-manifest.json"), "utf8"));
        expect(manifest).toMatchObject({
          ...provenance,
          app_name: appName, site_url: "https://example.com", architecture: "linux/arm64",
          source_sha: env.SOURCE_SHA, git_tree: env.GIT_TREE, workflow_sha: env.WORKFLOW_SHA,
          build_id: env.BUILD_ID, build_utc: env.BUILD_UTC, file_manifest_sha256: env.FILE_MANIFEST_SHA,
          platform_api_base: apiBase,
        });
        writeFileSync(join(root, "contract-provenance.json"), JSON.stringify({
          ...provenance, source_sha: "342341a82131a7f80a4e7508172f1e764ec7ad84",
        }));
        const mismatch = spawnSync(process.execPath, ["--input-type=module"], {
          input: manifestScript, encoding: "utf8", env,
        });
        expect(mismatch.status).not.toBe(0);
        expect(mismatch.stderr).toContain("Contract provenance source mismatch");
        writeFileSync(join(root, "contract-provenance.json"), JSON.stringify(provenance));
        delete env.NEXT_PUBLIC_APP_NAME;
        expect(spawnSync(process.execPath, ["--input-type=module"], {
          input: manifestScript, encoding: "utf8", env,
        }).status).not.toBe(0);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("compares public inputs with the manifest before publication and after re-download", () => {
    for (const name of ["Verify package before publication", "Verify re-download and ARM64 runtime"]) {
      const step = workflow.split(`- name: ${name}`)[1]?.split("      - name:")[0];
      expect(step).toContain(`test "$(node -p "require('./artifact-manifest.json').app_name")" = "$NEXT_PUBLIC_APP_NAME"`);
      expect(step).toContain(`test "$(node -p "require('./artifact-manifest.json').site_url")" = "$NEXT_PUBLIC_SITE_URL"`);
    }
  });
});

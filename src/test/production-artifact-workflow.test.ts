import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");
const sourceValidation = workflow.match(
  /- name: Validate source and contracts\n[\s\S]*?run: \|\n([\s\S]*?)(?=\n      - name:)/,
)?.[1];
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

describe("production artifact canonical audit toolchain", () => {
  it("pins both toolchains and Next without changing the manifest toolchain", () => {
    expect(workflow).toContain("PNPM_VERSION: 10.12.1");
    expect(workflow).toContain("PNPM_AUDIT_VERSION: 11.25.0");
    expect(workflow.match(/16\.3\.6/g)).toHaveLength(3);
    expect(workflow).not.toContain("16.3.3");
    expect(workflow).not.toContain("pnpm audit --audit-level high");
    expect(workflow).toContain("pnpm_version: process.env.PNPM_VERSION");
    expect(sourceValidation).toContain('audit_root="$(mktemp -d)"');
    expect(sourceValidation).toContain('cd "$audit_root"');
    expect(sourceValidation).toContain('--collect "$GITHUB_WORKSPACE/runtime" "$audit_root"');
  });

  it.each([
    { auditExit: "0", restoreVersion: "10.12.1", passes: true },
    { auditExit: "1", restoreVersion: "10.12.1", passes: false },
    { auditExit: "0", restoreVersion: "11.25.0", passes: false },
  ])("fails closed and restores the normal toolchain: %j", ({ auditExit, restoreVersion, passes }) => {
    expect(sourceValidation).toBeTruthy();
    const result = spawnSync("bash", ["-s"], {
      encoding: "utf8",
      env: {
        ...process.env, PNPM_VERSION: "10.12.1", PNPM_AUDIT_VERSION: "11.25.0",
        GITHUB_WORKSPACE: "/synthetic-workspace", AUDIT_EXIT: auditExit, RESTORE_VERSION: restoreVersion,
      },
      input: `
        active_version=10.12.1
        corepack() {
          if [ "$2" = "pnpm@11.25.0" ]; then active_version=11.25.0;
          else active_version="$RESTORE_VERSION"; fi
        }
        pnpm() {
          if [ "$1" = "--version" ]; then printf '%s\\n' "$active_version";
          else printf 'command:%s version:%s\\n' "$1" "$active_version"; fi
        }
        node() {
          test "$active_version" = 11.25.0 || return 90
          test "$1" = "$GITHUB_WORKSPACE/runtime/scripts/ci/security-audit-policy.mjs" || return 91
          test "$2" = --collect || return 92
          test "$3" = "$GITHUB_WORKSPACE/runtime" || return 93
          test "$PWD" = "$4" && test -d "$4" || return 94
          test "$PNPM_CONFIG_FETCH_TIMEOUT" = 300000 || return 95
          printf 'audit:11.25.0 isolated\\n'
          return "$AUDIT_EXIT"
        }
        ${sourceValidation}
      `,
    });
    expect(result.stdout).toContain("audit:11.25.0 isolated");
    if (passes) {
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("command:lint version:10.12.1");
      expect(result.stdout).toContain("command:test version:10.12.1");
    } else {
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain("command:lint");
    }
  });
});

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
          SOURCE_SHA: "0d81ef59f6867fe806c0efcb0b2c77ea1d05ad7b",
          WORKFLOW_SHA: "b".repeat(40),
          RUNNER_TEMP: root, NEXT_PUBLIC_APP_NAME: appName,
          NEXT_PUBLIC_SITE_URL: "https://example.com", NEXT_PUBLIC_PLATFORM_API_BASE_URL: apiBase,
        });
        const provenance = {
          source_sha: env.SOURCE_SHA, contract_version: "2.0.0-alpha.43", contract_artifact_id: "11349442812",
          contract_manifest_sha256: "1951edf44ef275e3c9bf85ac0ce1417a27bc64e982a607d0a72e49186eb09e74",
          contract_manifest_path: "vendor/oripa/CONTRACT-20261005/artifact-manifest.json",
          platform_runtime_source_sha: "4b7d00e8e31223136cd0b70134916d091dfea6cb",
          platform_authority_merge_sha: "48639e9cdc44e43534e45dbbb1b6eeb1bfc7d591",
          contract_archive_sha256: "53fb939978eabbf9b636369b15c81369d18305890891715f7bbd864e9b197d14",
          platform_source_sha: "0ce41ab473fd5a4fb44773041ae097ffb40b14ce",
          client_pin: "2.0.0-alpha.43", testkit_pin: "2.0.0-alpha.43", public_openapi_pin: "2.0.0-alpha.39",
          client_sha256: "9f14026a53d24413d860975d5c012988a5381771600b81e8309e5119a10792b0",
          testkit_sha256: "d5bb5b0d785437e0f400b369ff97663a6c69d4a329c1b82710017087a92af9fb",
          public_openapi_sha256: "37cdeb7a214d42f0f69458d578a81c5c7869132e2a6cbd02ca8d150f1abf6faa",
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

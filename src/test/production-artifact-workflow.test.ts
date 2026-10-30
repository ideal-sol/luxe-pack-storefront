import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { brandAssetUrl, brandAssetVersion } from "@/lib/brand-assets";

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
    expect(workflow).toContain("NODE_VERSION: 22.22.3");
    expect(workflow.match(/16\.4\.2/g)).toHaveLength(3);
    expect(workflow).not.toContain("16.3.8");
    expect(workflow).not.toContain("16.3.3");
    expect(workflow).not.toContain("16.3.6");
    expect(workflow).not.toContain("pnpm audit --audit-level high");
    expect(workflow).toContain("pnpm_version: process.env.PNPM_VERSION");
    expect(sourceValidation).toContain('audit_root="$(mktemp -d)"');
    expect(sourceValidation).toContain('cd "$audit_root"');
    expect(sourceValidation).toContain('--collect "$GITHUB_WORKSPACE/runtime" "$audit_root"');
    expect(workflow).toContain('test "$(node --version)" = "v$NODE_VERSION"');
    expect(workflow).toContain('test "$(pnpm --version)" = "$PNPM_VERSION"');
    expect(workflow).toContain('export NEXT_VERSION_ACTUAL="$next_version"');
    expect(workflow).toContain("next_version: process.env.NEXT_VERSION_ACTUAL");
    expect(workflow).toContain(`NEXT_PUBLIC_PLATFORM_API_BASE_URL: ${apiBase}`);
    const build = workflow.split("- name: Build exact production application")[1]?.split("      - name:")[0];
    expect(build).toContain(`test "$NEXT_PUBLIC_PLATFORM_API_BASE_URL" = "${apiBase}"`);
    expect(build).toContain("NEXT_PUBLIC_GTM_ID: GTM-5DQRPNN2");
    expect(build).not.toContain("unset NEXT_PUBLIC_PLATFORM_API_BASE_URL");
  });

  it.each([
    ["Set up exact pnpm and frozen dependencies", 'test "$(node -p "require(\'./node_modules/next/package.json\').version")" = "16.4.2"'],
    ["Package filesystem release", 'test "$next_version" = "16.4.2"'],
    ["Verify re-download and ARM64 runtime", 'test "$(node -p "require(\'./artifact-manifest.json\').next_version")" = "16.4.2"'],
  ])("keeps the exact Next version check fail-closed at %s", (name, command) => {
    const step = workflow.split(`- name: ${name}`)[1]?.split("      - name:")[0];
    expect(step).toContain(command);
    for (const actual of ["16.4.2", "16.3.8", "16.4.20", ""]) {
      // Run only this assertion with synthetic version reads: no Build/package/Dispatch.
      const result = spawnSync("bash", ["-s"], {
        encoding: "utf8",
        env: { ...process.env, FIXTURE_NEXT_VERSION: actual },
        input: `set -euo pipefail\nnode() { printf '%s\\n' "$FIXTURE_NEXT_VERSION"; }\nnext_version="$FIXTURE_NEXT_VERSION"\n${command}\n`,
      });
      expect(result.status === 0).toBe(actual === "16.4.2");
    }
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
        NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL: "https://d2c0gdzoj8l46h.cloudfront.net",
        NEXT_PUBLIC_STATIC_ASSET_BASE_URL: "https://d2c0gdzoj8l46h.cloudfront.net/static-assets",
        NEXT_PUBLIC_PLATFORM_API_BASE_URL: apiBase,
      },
      input: `
        active_version=10.12.1
        corepack() {
          if [ "$2" = "pnpm@11.25.0" ]; then active_version=11.25.0;
          else active_version="$RESTORE_VERSION"; fi
        }
        pnpm() {
          if [ "$1" = exec ] || [ "$1" = test ]; then
            test -z "\${NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL+x}" || return 96
            test -z "\${NEXT_PUBLIC_STATIC_ASSET_BASE_URL+x}" || return 97
          fi
          if [ "$1" = test ]; then
            test -z "\${NEXT_PUBLIC_PLATFORM_API_BASE_URL+x}" || return 98
          else
            test "$NEXT_PUBLIC_PLATFORM_API_BASE_URL" = "${apiBase}" || return 99
          fi
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
        test "$NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL" = https://d2c0gdzoj8l46h.cloudfront.net
        test "$NEXT_PUBLIC_STATIC_ASSET_BASE_URL" = https://d2c0gdzoj8l46h.cloudfront.net/static-assets
        test "$NEXT_PUBLIC_PLATFORM_API_BASE_URL" = "${apiBase}"
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
    expect(build).toContain("NEXT_PUBLIC_GTM_ID: GTM-5DQRPNN2");
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
          NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL: "https://d2c0gdzoj8l46h.cloudfront.net",
          NEXT_PUBLIC_STATIC_ASSET_BASE_URL: "https://d2c0gdzoj8l46h.cloudfront.net/static-assets",
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
        mkdirSync(join(root, ".next"));
        writeFileSync(join(root, ".next/gtm-build-observation.json"), JSON.stringify({
          gtm_id: "GTM-5DQRPNN2", gtm_enabled: true, build_id: env.BUILD_ID,
        }));
        const result = spawnSync(process.execPath, ["--input-type=module"], {
          cwd: root, input: manifestScript, encoding: "utf8", env,
        });
        expect(result.stderr).toBe("");
        expect(result.status).toBe(0);
        const manifest = JSON.parse(readFileSync(join(root, "storefront-release", "artifact-manifest.json"), "utf8"));
        expect(manifest).toMatchObject({
          ...provenance,
          app_name: appName, site_url: "https://example.com", architecture: "linux/arm64",
          source_sha: env.SOURCE_SHA, git_tree: env.GIT_TREE, workflow_sha: env.WORKFLOW_SHA,
          build_id: env.BUILD_ID, build_utc: env.BUILD_UTC, file_manifest_sha256: env.FILE_MANIFEST_SHA,
          gtm_id: "GTM-5DQRPNN2", gtm_enabled: true,
          platform_api_base: apiBase,
          asset_public_base_url: env.NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL,
          static_asset_base_url: env.NEXT_PUBLIC_STATIC_ASSET_BASE_URL,
        });
        writeFileSync(join(root, "contract-provenance.json"), JSON.stringify({
          ...provenance, source_sha: "342341a82131a7f80a4e7508172f1e764ec7ad84",
        }));
        const mismatch = spawnSync(process.execPath, ["--input-type=module"], {
          cwd: root, input: manifestScript, encoding: "utf8", env,
        });
        expect(mismatch.status).not.toBe(0);
        expect(mismatch.stderr).toContain("Contract provenance source mismatch");
        writeFileSync(join(root, "contract-provenance.json"), JSON.stringify(provenance));
        delete env.NEXT_PUBLIC_APP_NAME;
        expect(spawnSync(process.execPath, ["--input-type=module"], {
          cwd: root, input: manifestScript, encoding: "utf8", env,
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

const dynamicBase = "https://d2c0gdzoj8l46h.cloudfront.net";
const staticBase = `${dynamicBase}/static-assets`;
const cdnValidation = workflow.match(
  /- name: Validate production CDN inputs and resolver\n[\s\S]*?node --experimental-strip-types --input-type=module <<'NODE'\n([\s\S]*?)\n          NODE/,
)?.[1];
const bundleValidation = workflow.match(
  /- name: Verify CDN build output\n[\s\S]*?node --input-type=module <<'NODE'\n([\s\S]*?)\n          NODE/,
)?.[1];
const brandSmoke = workflow.match(/          const response = await fetch\("http:\/\/127.0.0.1:3299\/"\);[\s\S]*?(?=\n          NODE)/)?.[0];

function cdnEnvironment(dynamic?: string, fixed?: string) {
  const env = { ...process.env };
  delete env.NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL;
  delete env.NEXT_PUBLIC_STATIC_ASSET_BASE_URL;
  if (dynamic !== undefined) env.NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL = dynamic;
  if (fixed !== undefined) env.NEXT_PUBLIC_STATIC_ASSET_BASE_URL = fixed;
  return env;
}

describe("production CDN build authority", () => {
  it("requires both dispatch inputs and validates existing resolver prefixes before dependencies or build", () => {
    for (const name of ["asset_public_base_url", "static_asset_base_url"]) {
      expect(workflow).toMatch(new RegExp(`${name}:\\n\\s+description:.*\\n\\s+required: true\\n\\s+type: string`));
    }
    expect(workflow).toContain("NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL: ${{ inputs.asset_public_base_url }}");
    expect(workflow).toContain("NEXT_PUBLIC_STATIC_ASSET_BASE_URL: ${{ inputs.static_asset_base_url }}");
    expect(cdnValidation).toBeTruthy();
    expect(cdnValidation).not.toContain("${{");
    expect(workflow.indexOf("- name: Validate production CDN inputs and resolver"))
      .toBeLessThan(workflow.indexOf("- name: Set up exact pnpm and frozen dependencies"));
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module"], {
      input: cdnValidation, env: cdnEnvironment(dynamicBase, staticBase), encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(brandAssetVersion).toBe("sha256-3370b6a58282ca0d0f194c561f0ad8c07eded773629742953afbd169b28befd0");
    expect(workflow).toContain("sha256-e14476bb46508a7f82edab331cda7fb1b3071bda8dc63b4be693466d7ab92d12");
    expect(workflow).toContain(brandAssetVersion);
    for (const file of ["logo.webp", "icons/favicon.ico", "pokezou_sd.webp"]) {
      expect(brandAssetUrl(file, staticBase)).toBe(`${staticBase}/brand/sha256-5d603bd6eab81d6ddca776af3a5a875a9c4840859e1f57c054047f29f081df63/${file}`);
    }
    for (const file of ["sd_orika_touroku.webp", "sd_pokezou_coin.webp"]) {
      expect(brandAssetUrl(file, staticBase)).toBe(`${staticBase}/brand/sha256-6f32debad818f4907f5eb1593c8a7a0e31b2cc2edfb2f1f7f1d9f813f1e89c5d/${file}`);
    }
  });

  it.each([
    undefined, "", " ", "http://cdn.example.test", "https://cdn.example.test/", "https://cdn.example.test/path",
    "https://cdn.example.test?", "https://cdn.example.test?x=1", "https://cdn.example.test#", "https://cdn.example.test#fragment",
    "https://user:password@cdn.example.test", "https://@cdn.example.test", "https://cdn.example.test:443",
    " https://cdn.example.test", "https://cdn.example.test\n", "https://cdn.example.test\\path", "https://bad..example.test",
    "https://%63dn.example.test", "https://cdn.example.test/..", "$(false); `false`",
  ])("fails closed for malformed Dynamic origin %j", (dynamic) => {
    expect(cdnValidation).toBeTruthy();
    expect(spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module"], {
      input: cdnValidation, env: cdnEnvironment(dynamic, `${dynamic}/static-assets`), encoding: "utf8",
    }).status).not.toBe(0);
  });

  it.each([undefined, "", dynamicBase, `${staticBase}/`, `${staticBase}?`, `${staticBase}#`, `${staticBase}/..`, "https://other.example/static-assets"])(
    "fails closed for a missing or mismatched Static base %j", (fixed) => {
      expect(cdnValidation).toBeTruthy();
      expect(spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module"], {
        input: cdnValidation, env: cdnEnvironment(dynamicBase, fixed), encoding: "utf8",
      }).status).not.toBe(0);
    },
  );

  it("compares both manifest fields before tar creation, before upload and after exact-ID download", () => {
    for (const [field, variable] of [["asset_public_base_url", "NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL"], ["static_asset_base_url", "NEXT_PUBLIC_STATIC_ASSET_BASE_URL"]]) {
      expect(workflow).toContain(`${field}: process.env.${variable}`);
      const beforeTar = workflow.indexOf(`'/storefront-release/artifact-manifest.json').${field}`);
      expect(beforeTar).toBeGreaterThan(0);
      expect(beforeTar).toBeLessThan(workflow.indexOf('archive_name="luxe-pack-storefront-production-'));
      for (const name of ["Verify package before publication", "Verify re-download and ARM64 runtime"]) {
        expect(workflow.split(`- name: ${name}`)[1]?.split("      - name:")[0])
          .toContain(`test "$(node -p "require('./artifact-manifest.json').${field}")" = "$${variable}"`);
      }
    }
  });

  it.each(["valid", "valid-legacy", "payment27", "tampered-payment27", "candidate29", "tampered-candidate29", "unknown-version", "missing-client", "missing-server", "moved-existing", "wrong-new-prefix", "duplicate-path"])("checks compiled CDN literals in both bundle surfaces: %s", (mode) => {
    expect(bundleValidation).toBeTruthy();
    const root = mkdtempSync(join(tmpdir(), "storefront-cdn-bundle-"));
    try {
      mkdirSync(join(root, "src/lib"), { recursive: true });
      const manifest = JSON.parse(readFileSync("src/lib/brand-assets.manifest.json", "utf8"));
      // Retain 23/25/27 rollback authority and admit only the exact 27 and 29 candidate bytes.
      const flowFiles = ["sd_fukumaru_gacha.webp", "sd_orika_uketoru.webp"];
      if (!["candidate29", "tampered-candidate29"].includes(mode)) {
        manifest.version = "sha256-e14476bb46508a7f82edab331cda7fb1b3071bda8dc63b4be693466d7ab92d12";
        manifest.files = manifest.files.filter((file: { relative_path: string }) => !flowFiles.includes(file.relative_path));
      }
      if (!["candidate29", "tampered-candidate29", "payment27", "tampered-payment27"].includes(mode)) {
        manifest.version = "sha256-6f32debad818f4907f5eb1593c8a7a0e31b2cc2edfb2f1f7f1d9f813f1e89c5d";
        manifest.files = manifest.files.filter((file: { relative_path: string }) => !file.relative_path.startsWith("payments/"));
      }
      if (mode === "valid-legacy") {
        manifest.version = "sha256-5d603bd6eab81d6ddca776af3a5a875a9c4840859e1f57c054047f29f081df63";
        manifest.files = manifest.files.filter((file: { relative_path: string }) => !["sd_orika_touroku.webp", "sd_pokezou_coin.webp"].includes(file.relative_path));
      }
      if (mode === "unknown-version") manifest.version = "sha256-" + "0".repeat(64);
      if (mode === "moved-existing") manifest.files[0].object_key = `static-assets/brand/${manifest.version}/${manifest.files[0].relative_path}`;
      if (mode === "wrong-new-prefix") manifest.files.find((file: { relative_path: string }) => file.relative_path === "sd_orika_touroku.webp").object_key = "static-assets/brand/wrong/sd_orika_touroku.webp";
      if (mode === "duplicate-path") manifest.files[1] = manifest.files[0];
      if (mode === "tampered-candidate29" || mode === "tampered-payment27") manifest.files[0].sha256 = "0".repeat(64);
      writeFileSync(join(root, "src/lib/brand-assets.manifest.json"), mode === "candidate29"
        ? readFileSync("src/lib/brand-assets.manifest.json")
        : mode === "payment27" ? `${JSON.stringify(manifest, null, 2)}\n` : JSON.stringify(manifest));
      for (const [surface, omitted] of [["static", "missing-client"], ["server", "missing-server"]]) {
        mkdirSync(join(root, `.next/${surface}`), { recursive: true });
        writeFileSync(join(root, `.next/${surface}/bundle.js`), mode === omitted ? '"/brand/logo.webp"' : `${JSON.stringify(dynamicBase)};${JSON.stringify(staticBase)};`);
      }
      const result = spawnSync(process.execPath, ["--input-type=module"], {
        cwd: root, input: bundleValidation, env: cdnEnvironment(dynamicBase, staticBase), encoding: "utf8",
      });
      expect(result.status === 0).toBe(["valid", "valid-legacy", "payment27", "candidate29"].includes(mode));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(["valid", "local-only", "missing-favicon"])("checks rendered Brand URLs without runtime CDN environment: %s", (mode) => {
    expect(brandSmoke).toBeTruthy();
    expect(workflow).toContain("env -u NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL -u NEXT_PUBLIC_STATIC_ASSET_BASE_URL pnpm exec next start");
    const files = mode === "missing-favicon" ? ["logo.webp", "pokezou_sd.webp"] : ["logo.webp", "icons/favicon.ico", "pokezou_sd.webp"];
    const html = files.map(file => `<img src="${mode === "local-only" ? `/brand/${file}` : brandAssetUrl(file, staticBase)}">`).join("");
    const result = spawnSync(process.execPath, ["--input-type=module"], {
      input: `globalThis.fetch = async () => ({ ok: true, text: async () => ${JSON.stringify(html)} });\n${brandSmoke}`,
      env: cdnEnvironment(dynamicBase, staticBase), encoding: "utf8",
    });
    expect(result.status === 0).toBe(mode === "valid");
  });
});

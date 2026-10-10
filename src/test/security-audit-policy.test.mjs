import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectAudits, readEvidence, validateEvidence } from "../../scripts/ci/security-audit-policy.mjs";

const repository = process.cwd();
const manifest = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"));
const lockfile = readFileSync(join(repository, "pnpm-lock.yaml"), "utf8");
const target = {
  id: 1240992,
  github_advisory_id: "GHSA-vfj7-8cjw-p6xm",
  url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
  module_name: "braces",
  severity: "high",
  vulnerable_versions: "<=3.0.3",
  patched_versions: null,
  patched_versions_unpublished: true,
  cwe: "CWE-674",
  findings: [{
    version: "3.0.3",
    paths: [".>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces"],
    dev: true, optional: false, bundled: false,
  }],
};
const temporaryDirectories = [];

function audit(advisories = []) {
  const vulnerabilities = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const advisory of advisories) vulnerabilities[advisory.severity] += 1;
  return { advisories: Object.fromEntries(advisories.map(advisory => [String(advisory.id), structuredClone(advisory)])), metadata: { vulnerabilities } };
}

function evidence(advisories = [target], runtime = []) {
  return {
    full: audit(advisories), production: audit(runtime),
    statuses: { full: Number(advisories.length > 0), production: Number(runtime.length > 0) },
    manifest: structuredClone(manifest), lockfile,
  };
}

function otherAdvisory(severity = "moderate") {
  return {
    ...structuredClone(target), id: 1193683, github_advisory_id: "GHSA-82fw-gwwq-j7x9",
    url: "https://github.com/advisories/GHSA-82fw-gwwq-j7x9", module_name: "vitest", severity,
    findings: [{ version: "4.1.10", paths: [".>vitest"], dev: true, optional: false, bundled: false }],
  };
}

function directory() {
  const path = mkdtempSync(join(tmpdir(), "storefront-audit-policy-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("Storefront exact dev-tool security policy", () => {
  it("accepts the exact installed dev chain and reports the vulnerability honestly", () => {
    expect(manifest.dependencies["sanitize-html"]).toBe("2.17.7");
    expect(validateEvidence(evidence())).toMatchObject({
      status: "PASS", blocking_threshold: "high", production_findings_all_severities: 0,
      full_current_high_critical_findings: 1, approved_exact_dev_tool_exceptions: 1,
      unapproved_high_critical_findings: 0,
      approved_security_fingerprint: { absent_fields: { cve: "ABSENT", cves: "ABSENT", cvss: "ABSENT" }, dev_only_proof: "PASS" },
    });
  });

  it.each(["info", "low", "moderate"])("keeps %s nonblocking and visible in full audits", severity => {
    const summary = validateEvidence(evidence([target, otherAdvisory(severity)]));
    expect(summary.full_severities[severity]).toBe(1);
    expect(summary.full_findings).toHaveLength(2);
    expect(summary.approved_exact_dev_tool_exceptions).toBe(1);
  });

  it("keeps Moderate-only full audit exit 1 nonblocking after braces resolves", () => {
    expect(validateEvidence(evidence([otherAdvisory()]))).toMatchObject({
      full_moderate_findings: 1, approved_exact_dev_tool_exceptions: 0,
      full_current_high_critical_findings: 0, exception_state: "RESOLVED / IMPROVED",
    });
  });

  it("does not introduce blocking policy for unrelated Moderate braces advisories", () => {
    const unrelated = { ...structuredClone(target), id: 9999999, severity: "moderate", github_advisory_id: "GHSA-aaaa-bbbb-cccc", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" };
    expect(validateEvidence(evidence([target, unrelated])).full_moderate_findings).toBe(1);
  });

  it("accepts clean audits when the advisory disappears", () => {
    expect(validateEvidence(evidence([]))).toMatchObject({ exception_state: "RESOLVED / IMPROVED", approved_exact_dev_tool_exceptions: 0 });
  });

  it.each(["info", "low", "moderate", "high", "critical"])("rejects production %s without exceptions", severity => {
    const runtime = otherAdvisory(severity);
    runtime.findings[0].dev = false;
    expect(() => validateEvidence(evidence([target, runtime], [runtime]))).toThrow("Production findings");
  });

  it("rejects braces in the production audit", () => {
    expect(() => validateEvidence(evidence([target], [target]))).toThrow("Production findings");
  });

  it("rejects sanitize-html advisory recurrence", () => {
    const runtime = {
      ...otherAdvisory(), id: 1153195, github_advisory_id: "GHSA-g8qq-57p8-ggw5",
      url: "https://github.com/advisories/GHSA-g8qq-57p8-ggw5", module_name: "sanitize-html",
      findings: [{ version: "2.17.7", paths: [".>sanitize-html"], dev: false, optional: false, bundled: false }],
    };
    expect(() => validateEvidence(evidence([runtime], [runtime]))).toThrow("Production findings");
    expect(() => validateEvidence(evidence([runtime]))).toThrow("sanitize-html advisory reappeared");
  });

  it.each([
    ["advisory ID", advisory => { advisory.github_advisory_id = "GHSA-aaaa-bbbb-cccc"; advisory.url = "https://github.com/advisories/GHSA-aaaa-bbbb-cccc"; }],
    ["audit ID", advisory => { advisory.id = 1240993; }],
    ["package", advisory => { advisory.module_name = "micromatch"; advisory.findings[0].version = "4.0.8"; }],
    ["version", advisory => { advisory.findings[0].version = "3.0.2"; }],
    ["path", advisory => { advisory.findings[0].paths = [".>braces"]; }],
    ["additional path", advisory => { advisory.findings[0].paths.push(".>braces"); }],
    ["runtime scope", advisory => { advisory.findings[0].dev = false; }],
    ["optional scope", advisory => { advisory.findings[0].optional = true; }],
    ["bundled scope", advisory => { advisory.findings[0].bundled = true; }],
    ["severity downgrade", advisory => { advisory.severity = "moderate"; }],
    ["severity upgrade", advisory => { advisory.severity = "critical"; }],
    ["vulnerable range", advisory => { advisory.vulnerable_versions = "<3.0.3"; }],
    ["published patch", advisory => { advisory.patched_versions = ">=3.0.4"; }],
    ["unpublished state", advisory => { advisory.patched_versions_unpublished = false; }],
    ["missing patched state", advisory => { delete advisory.patched_versions; }],
    ["CWE", advisory => { advisory.cwe = "CWE-400"; }],
    ["CWE shape", advisory => { advisory.cwe = ["CWE-674"]; }],
    ["CVE appearance", advisory => { advisory.cves = ["CVE-2026-12345"]; }],
    ["CVE null appearance", advisory => { advisory.cve = null; }],
    ["CVSS appearance", advisory => { advisory.cvss = { score: 7.5, vectorString: "changed" }; }],
    ["CVSS empty appearance", advisory => { advisory.cvss = {}; }],
    ["CVSS alias appearance", advisory => { advisory.cvss_score = 7.5; }],
  ])("rejects changed %s", (_name, mutate) => {
    const changed = structuredClone(target);
    mutate(changed);
    expect(() => validateEvidence(evidence([changed]))).toThrow();
  });

  it.each(["title", "overview", "references", "created", "updated", "recommendation", "attribution", "description"])("ignores descriptive %s changes", field => {
    const changed = { ...structuredClone(target), [field]: "Description-only update" };
    expect(validateEvidence(evidence([changed])).status).toBe("PASS");
  });

  it.each(["high", "critical"])("rejects a second %s advisory", severity => {
    expect(() => validateEvidence(evidence([target, otherAdvisory(severity)]))).toThrow("Unapproved High/Critical");
  });

  it.each(["dependencies", "optionalDependencies", "peerDependencies"])("rejects a runtime root in %s", section => {
    const input = evidence();
    input.manifest[section] = { ...input.manifest[section], "eslint-config-next": manifest.devDependencies["eslint-config-next"] };
    expect(() => validateEvidence(input)).toThrow();
  });

  it("rejects a missing root dev dependency", () => {
    const input = evidence();
    delete input.manifest.devDependencies["eslint-config-next"];
    expect(() => validateEvidence(input)).toThrow();
  });

  it.each([null, [], "invalid", { dependencies: null }, { devDependencies: [] }])("rejects malformed manifests: %j", badManifest => {
    expect(() => validateEvidence({ ...evidence(), manifest: badManifest })).toThrow();
  });

  it.each([
    ["missing lock", ""],
    ["wrong version", lockfile.replaceAll("braces@3.0.3", "braces@3.0.2")],
    ["wrong chain", lockfile.replace("      micromatch: 4.0.8", "      different-package: 4.0.8")],
    ["manifest drift", lockfile.replace(`specifier: ${manifest.dependencies.next}`, "specifier: 0.0.0")],
    ["unsupported schema", lockfile.replace("lockfileVersion: '9.0'", "lockfileVersion: '8.0'")],
  ])("rejects %s", (_name, badLock) => {
    expect(() => validateEvidence({ ...evidence(), lockfile: badLock })).toThrow();
  });

  it.each([
    ["missing audit", input => { delete input.full; }],
    ["malformed audit", input => { input.full = []; }],
    ["audit error", input => { input.full.error = { code: "NETWORK" }; }],
    ["suppression", input => { input.full.muted = [1240992]; }],
    ["filtered findings", input => { input.full.metadata.vulnerabilities.moderate = 5; }],
    ["missing counts", input => { delete input.full.metadata; }],
    ["invalid count", input => { input.full.metadata.vulnerabilities.high = "1"; }],
    ["missing findings", input => { input.full.advisories[1240992].findings = []; }],
    ["audit ID mismatch", input => { input.full.advisories[1240992].id = 1240993; }],
    ["missing statuses", input => { delete input.statuses; }],
    ["full exit mismatch", input => { input.statuses.full = 0; }],
    ["production exit mismatch", input => { input.statuses.production = 1; }],
    ["command failure", input => { input.statuses.full = 127; }],
    ["killed audit", input => { input.statuses.full = null; }],
    ["string exit", input => { input.statuses.full = "1"; }],
  ])("fails closed on %s", (_name, mutate) => {
    const input = evidence();
    mutate(input);
    expect(() => validateEvidence(input)).toThrow();
  });

  it("rejects production exit 0 with hidden Moderate findings", () => {
    const input = evidence();
    input.production.metadata.vulnerabilities.moderate = 1;
    expect(() => validateEvidence(input)).toThrow("parsed findings contradict");
  });

  it("rejects missing and malformed JSON files", () => {
    const path = directory();
    expect(() => readEvidence(repository, path)).toThrow();
    writeFileSync(join(path, "full.json"), "{broken");
    expect(() => readEvidence(repository, path)).toThrow();
  });

  it("fails closed when the audit command is unavailable", () => {
    const path = directory();
    expect(() => collectAudits(repository, path, join(path, "missing-pnpm"))).toThrow("audit command unavailable");
  });
});

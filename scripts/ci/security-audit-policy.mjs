import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const severities = ["info", "low", "moderate", "high", "critical"];
const advisoryId = "GHSA-vfj7-8cjw-p6xm";
const approvedPath = ".>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces";
const approvedFingerprint = {
  id: 1240992,
  github_advisory_id: advisoryId,
  module_name: "braces",
  severity: "high",
  vulnerable_versions: "<=3.0.3",
  patched_versions: null,
  patched_versions_unpublished: true,
  cwe: "CWE-674",
};
const absentFields = ["cve", "cves", "CVE", "cvss", "CVSS", "cvss_score", "cvss_vector"];

function requireState(condition, message) {
  if (!condition) throw new Error(message);
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function string(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function unquote(value) {
  return value.replace(/^(['"])(.*)\1$/, "$2");
}

function lockEntries(block, indent) {
  const entries = new Map();
  let current;
  for (const line of block.split("\n")) {
    if (!line.trim()) continue;
    const spaces = line.length - line.trimStart().length;
    requireState(spaces >= indent && !line.includes("\t"), "Unsupported lockfile indentation");
    if (spaces === indent) {
      const match = line.trim().match(/^(.+?):(?: (.*))?$/);
      requireState(match, "Malformed lockfile entry");
      current = unquote(match[1]);
      requireState(!entries.has(current), "Duplicate lockfile entry");
      entries.set(current, { value: unquote(match[2] ?? ""), body: "" });
    } else {
      requireState(current !== undefined, "Malformed lockfile nesting");
      entries.get(current).body += `${line}\n`;
    }
  }
  return entries;
}

function children(entries, key, indent) {
  const entry = entries.get(key);
  requireState(entry && entry.value === "", `Missing lockfile mapping: ${key}`);
  return lockEntries(entry.body, indent);
}

function readLock(lock) {
  requireState(string(lock), "Missing lockfile");
  const sections = lockEntries(lock, 0);
  requireState(sections.get("lockfileVersion")?.value === "9.0", "Unsupported lockfile version");
  const importers = children(sections, "importers", 2);
  requireState(importers.size === 1 && importers.has("."), "Unexpected lockfile importers");
  return {
    root: children(importers, ".", 4),
    packages: children(sections, "packages", 2),
    snapshots: children(sections, "snapshots", 2),
  };
}

function validateManifest(manifest, lock) {
  requireState(record(manifest), "Malformed manifest");
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    const dependencies = Object.hasOwn(manifest, section) ? manifest[section] : {};
    requireState(record(dependencies) && Object.values(dependencies).every(string), "Malformed manifest dependencies");
    if (section === "peerDependencies") continue;
    const locked = lock.root.has(section) ? children(lock.root, section, 6) : new Map();
    requireState(isDeepStrictEqual([...locked.keys()].sort(), Object.keys(dependencies).sort()), "Manifest/lock dependency mismatch");
    for (const [name, version] of Object.entries(dependencies)) {
      const fields = children(locked, name, 8);
      requireState(fields.get("specifier")?.value === version && string(fields.get("version")?.value), "Manifest/lock version mismatch");
    }
  }
}

function lockedVersion(lock, name, version) {
  const key = `${name}@${version}`;
  return lock.packages.has(key) && [...lock.snapshots.keys()].some(snapshot => snapshot === key || snapshot.startsWith(`${key}(`));
}

function parseAudit(audit, status, lock, scope) {
  requireState(record(audit) && record(audit.advisories) && record(audit.metadata), `${scope}: malformed audit JSON`);
  requireState(!Object.hasOwn(audit, "error") && !Object.hasOwn(audit, "muted"), `${scope}: audit error or suppression`);
  const counts = audit.metadata.vulnerabilities;
  requireState(record(counts) && isDeepStrictEqual(Object.keys(counts).sort(), [...severities].sort()), `${scope}: malformed severity counts`);
  requireState(Object.values(counts).every(count => Number.isSafeInteger(count) && count >= 0), `${scope}: invalid severity counts`);
  const actual = Object.fromEntries(severities.map(severity => [severity, 0]));
  const findings = [];
  for (const [auditId, advisory] of Object.entries(audit.advisories)) {
    requireState(record(advisory) && Number.isSafeInteger(advisory.id) && String(advisory.id) === auditId, `${scope}: invalid audit ID`);
    requireState(severities.includes(advisory.severity) && string(advisory.module_name), `${scope}: invalid advisory identity`);
    requireState(typeof advisory.github_advisory_id === "string" && /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(advisory.github_advisory_id), `${scope}: invalid advisory ID`);
    requireState(advisory.url === `https://github.com/advisories/${advisory.github_advisory_id}`, `${scope}: advisory URL mismatch`);
    requireState(Array.isArray(advisory.findings) && advisory.findings.length > 0, `${scope}: missing findings`);
    actual[advisory.severity] += 1;
    const seen = new Set();
    for (const finding of advisory.findings) {
      requireState(record(finding) && string(finding.version) && Array.isArray(finding.paths) && finding.paths.length > 0, `${scope}: malformed finding`);
      requireState(["dev", "optional", "bundled"].every(field => typeof finding[field] === "boolean"), `${scope}: missing dependency scope`);
      requireState(lockedVersion(lock, advisory.module_name, finding.version), `${scope}: finding version absent from lockfile`);
      for (const path of finding.paths) {
        requireState(string(path) && path.startsWith(".>") && !seen.has(`${finding.version}:${path}`), `${scope}: invalid or duplicate dependency path`);
        seen.add(`${finding.version}:${path}`);
      }
    }
    findings.push({ audit_id: auditId, advisory });
  }
  requireState(isDeepStrictEqual(actual, counts), `${scope}: parsed findings contradict severity counts (filtered evidence is forbidden)`);
  requireState(Number.isInteger(status) && status === Number(findings.length > 0), `${scope}: raw exit contradicts all-severity findings or audit command failed`);
  return { counts, findings };
}

function proveDevChain(manifest, lock) {
  requireState(string(manifest.devDependencies?.["eslint-config-next"]), "eslint-config-next must be a root dev dependency");
  requireState(["dependencies", "optionalDependencies", "peerDependencies"].every(section => !Object.hasOwn(manifest[section] ?? {}, "eslint-config-next")), "eslint-config-next has runtime exposure");
  const rootDev = children(lock.root, "devDependencies", 6);
  let version = children(rootDev, "eslint-config-next", 8).get("version")?.value;
  const chain = approvedPath.split(">").slice(1);
  for (const [index, name] of chain.entries()) {
    requireState(string(version), "Missing locked dev-tool dependency version");
    const snapshot = `${name}@${version}`;
    requireState(lock.snapshots.has(snapshot) && lock.packages.has(`${name}@${version.split("(")[0]}`), "Locked dev-tool chain is missing");
    if (index === chain.length - 1) {
      requireState(version === "3.0.3", "Locked braces version changed");
    } else {
      const dependencies = children(children(lock.snapshots, snapshot, 4), "dependencies", 6);
      version = dependencies.get(chain[index + 1])?.value;
    }
  }
}

function validateException(finding, manifest, lock) {
  const { audit_id: auditId, advisory } = finding;
  requireState(auditId === "1240992", "Approved audit ID changed");
  for (const [field, expected] of Object.entries(approvedFingerprint)) {
    requireState(Object.hasOwn(advisory, field) && isDeepStrictEqual(advisory[field], expected), `Security fingerprint changed: ${field}; Human review / DEPENDENCY_REMEDIATION_REQUIRED`);
  }
  requireState(absentFields.every(field => !Object.hasOwn(advisory, field)), "Security fingerprint changed: CVE/CVSS presence");
  requireState(isDeepStrictEqual(advisory.findings, [{ version: "3.0.3", paths: [approvedPath], dev: true, optional: false, bundled: false }]), "Approved version/path/dev-only scope changed");
  proveDevChain(manifest, lock);
}

export function validateEvidence({ full, production, statuses, manifest, lockfile }) {
  const lock = readLock(lockfile);
  validateManifest(manifest, lock);
  requireState(record(statuses) && isDeepStrictEqual(Object.keys(statuses).sort(), ["full", "production"]), "Missing audit statuses");
  const fullResult = parseAudit(full, statuses.full, lock, "full");
  const productionResult = parseAudit(production, statuses.production, lock, "production");
  requireState(productionResult.findings.length === 0, "Production findings must be zero across ALL severities; no exception applies");
  let approved = 0;
  for (const finding of fullResult.findings) {
    const advisory = finding.advisory;
    requireState(advisory.github_advisory_id !== "GHSA-g8qq-57p8-ggw5", "sanitize-html advisory reappeared");
    if (advisory.github_advisory_id === advisoryId || finding.audit_id === "1240992") {
      validateException(finding, manifest, lock);
      approved += 1;
    } else {
      requireState(!["high", "critical"].includes(advisory.severity), "Unapproved High/Critical advisory");
    }
  }
  requireState(approved <= 1, "Multiple dev-tool exceptions are forbidden");
  return {
    status: "PASS",
    blocking_threshold: "high",
    raw_exit: statuses,
    production_severities: productionResult.counts,
    production_findings_all_severities: productionResult.findings.length,
    full_severities: fullResult.counts,
    full_current_high_critical_findings: fullResult.counts.high + fullResult.counts.critical,
    approved_exact_dev_tool_exceptions: approved,
    unapproved_high_critical_findings: 0,
    full_moderate_findings: fullResult.counts.moderate,
    exception_state: approved ? "APPLIED" : "RESOLVED / IMPROVED",
    approved_security_fingerprint: approved ? {
      source: "pnpm", audit_id: "1240992", ...approvedFingerprint,
      locked_version: "3.0.3", path: approvedPath, dev_only_proof: "PASS",
      absent_fields: Object.fromEntries(absentFields.map(field => [field, "ABSENT"])),
    } : null,
    full_findings: fullResult.findings.map(({ audit_id, advisory }) => ({
      audit_id, advisory_id: advisory.github_advisory_id, package: advisory.module_name,
      severity: advisory.severity, findings: advisory.findings,
    })),
  };
}

export function readEvidence(repository, directory) {
  const json = name => JSON.parse(readFileSync(resolve(directory, name), "utf8"));
  return validateEvidence({
    full: json("full.json"), production: json("production.json"), statuses: json("statuses.json"),
    manifest: JSON.parse(readFileSync(resolve(repository, "package.json"), "utf8")),
    lockfile: readFileSync(resolve(repository, "pnpm-lock.yaml"), "utf8"),
  });
}

export function collectAudits(repository, directory, command = "pnpm") {
  requireState(resolve(repository) !== resolve(directory), "Audit directory must be isolated");
  mkdirSync(directory, { recursive: true });
  copyFileSync(resolve(repository, "pnpm-lock.yaml"), resolve(directory, "pnpm-lock.yaml"));
  const statuses = {};
  for (const [scope, extra] of [["full", []], ["production", ["--prod"]]]) {
    const result = spawnSync(command, ["audit", ...extra, "--audit-level", "info", "--json"], { cwd: directory, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    writeFileSync(resolve(directory, `${scope}.json`), result.stdout ?? "");
    statuses[scope] = result.status;
    console.log(`${scope} audit raw exit: ${result.status}`);
    requireState(!result.error && !result.signal && [0, 1].includes(result.status), `${scope}: audit command unavailable or failed`);
  }
  writeFileSync(resolve(directory, "statuses.json"), `${JSON.stringify(statuses)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, repository, directory, ...extra] = process.argv.slice(2);
    requireState(["--collect", "--validate"].includes(mode) && repository && directory && extra.length === 0, "Usage: security-audit-policy.mjs --collect|--validate REPOSITORY AUDIT_DIRECTORY");
    if (mode === "--collect") collectAudits(resolve(repository), resolve(directory));
    const summary = readEvidence(resolve(repository), resolve(directory));
    writeFileSync(resolve(directory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(`security-audit-policy: FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}

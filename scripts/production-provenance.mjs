import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const authorityRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const authorityPath = "docs/production-approved-source.json";
const repository = "ideal-sol/luxe-pack-storefront";
const requiredChecks = ["policy-gate", "quality-gate", "security-gate", "integration-gate", "ci-gate"];
const fullSha = /^[0-9a-f]{40}$/;
export const approvedSource = JSON.parse(readFileSync(join(authorityRoot, authorityPath), "utf8"));

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function digest(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export function validateProvenance(root, authority = approvedSource) {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const clientPin = packageJson.dependencies?.["@oripa/storefront-client"];
  const testkitPin = packageJson.devDependencies?.["@oripa/storefront-testkit"];
  const directory = dirname(authority.manifest_path);
  requireValue(directory === "vendor/oripa/CONTACT-PREFILL-001", "stale provenance authority");
  requireValue(authority.contract_version === "2.0.0-alpha.38", "unapproved contract version");
  const manifestPath = join(root, directory, "artifact-manifest.json");
  requireValue(digest(manifestPath) === authority.manifest_sha256, "manifest digest mismatch");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  requireValue(manifest.bundle?.version === authority.contract_version && manifest.bundle?.immutable === true,
    "source and manifest contract mismatch");
  requireValue(manifest.source_commit === authority.platform_source_sha, "Platform source mismatch");
  const provenance = readFileSync(join(root, directory, "PROVENANCE.md"), "utf8");
  const identifiers = [...provenance.matchAll(/immutable Artifact ID: `([0-9]+)`/g)].map((match) => match[1]);
  requireValue(identifiers.length === 1 && identifiers[0] === authority.artifact_id, "Artifact ID mismatch");
  const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
  for (const [name, pin, expectedDigest] of [
    ["@oripa/storefront-client", clientPin, authority.client_sha256],
    ["@oripa/storefront-testkit", testkitPin, authority.testkit_sha256],
  ]) {
    const entries = manifest.packages.filter((entry) => entry.name === name);
    requireValue(entries.length === 1, "package manifest identity mismatch");
    const entry = entries[0];
    const file = `${name.replace("@", "").replace("/", "-")}-${authority.contract_version}.tgz`;
    requireValue(entry.version === authority.contract_version && entry.file === file
      && entry.sha256 === expectedDigest && entry.disposition === "published", "Client/Testkit mismatch");
    requireValue(pin === `file:${directory}/${file}`, "source dependency pin mismatch");
    requireValue(lockfile.includes(`      '${name}':\n        specifier: ${pin}\n        version: ${pin}\n`),
      "lockfile pin mismatch");
    requireValue(digest(join(root, directory, file)) === expectedDigest, "package digest mismatch");
  }
  const testkit = manifest.packages.find((entry) => entry.name === "@oripa/storefront-testkit");
  requireValue(testkit.storefront_client_version === authority.contract_version, "Client/Testkit mismatch");
  requireValue(manifest.public_openapi?.file === "public.openapi.json"
    && manifest.public_openapi.sha256 === authority.public_openapi_sha256
    && digest(join(root, directory, "public.openapi.json")) === authority.public_openapi_sha256,
  "Public OpenAPI digest mismatch");
  return {
    source_sha: authority.source_sha,
    contract_version: authority.contract_version,
    contract_artifact_id: authority.artifact_id,
    contract_manifest_path: authority.manifest_path,
    contract_manifest_sha256: authority.manifest_sha256,
    platform_source_sha: authority.platform_source_sha,
    client_pin: manifest.bundle.version,
    testkit_pin: manifest.bundle.version,
    client_sha256: authority.client_sha256,
    testkit_sha256: authority.testkit_sha256,
    public_openapi_pin: manifest.public_openapi.version,
    public_openapi_sha256: authority.public_openapi_sha256,
  };
}

async function apiGet(suffix) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${suffix}`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GH_TOKEN}` },
    signal: AbortSignal.timeout(30000),
  });
  requireValue(response.ok, "GitHub authority lookup failed");
  return response.json();
}

export async function checkRuns(get, sha) {
  const latest = new Map();
  let received = 0;
  for (let page = 1; page <= 10; page++) {
    const payload = await get(`commits/${sha}/check-runs?filter=all&per_page=100&page=${page}`);
    requireValue(Array.isArray(payload.check_runs) && Number.isInteger(payload.total_count), "invalid check response");
    received += payload.check_runs.length;
    for (const check of payload.check_runs) {
      if (!requiredChecks.includes(check.name)) continue;
      requireValue(check.head_sha === sha && check.app?.id === 15368 && check.app.slug === "github-actions"
        && check.app.owner?.login === "github", "check source mismatch");
      requireValue(Number.isInteger(check.id) && Number.isFinite(Date.parse(check.started_at)), "invalid check order");
      const previous = latest.get(check.name);
      if (!previous || Date.parse(check.started_at) > Date.parse(previous.started_at)
        || check.started_at === previous.started_at && check.id > previous.id) latest.set(check.name, check);
    }
    if (payload.check_runs.length < 100) {
      requireValue(received >= payload.total_count, "truncated check response");
      return latest;
    }
  }
  throw new Error("truncated check response");
}

function requireChecks(checks) {
  requireValue(requiredChecks.every((name) => checks.get(name)?.status === "completed"
    && checks.get(name)?.conclusion === "success"), "required checks not successful");
}

async function reviewedHead(get, sha, pull) {
  requireValue(pull.merged === true && pull.merge_commit_sha === sha && pull.base?.ref === "main"
    && pull.head?.repo?.full_name === repository && fullSha.test(pull.head.sha), "merged source PR mismatch");
  const source = await get(`git/commits/${sha}`);
  const reviewed = await get(`git/commits/${pull.head.sha}`);
  requireValue(fullSha.test(source.tree?.sha) && source.tree.sha === reviewed.tree?.sha, "reviewed tree mismatch");
  requireChecks(await checkRuns(get, pull.head.sha));
  return pull.head.sha;
}

export async function authorize(root, sourceSha, workflowSha, get = apiGet) {
  requireValue(fullSha.test(sourceSha) && fullSha.test(workflowSha), "invalid exact SHA");
  const authority = JSON.parse(git(root, "show", `${workflowSha}:${authorityPath}`));
  requireValue(authority.repository === repository && authority.schema_version === "1.0"
    && authority.source_sha === sourceSha && authority.activation_authorized === false
    && authority.authority?.startsWith("Human-approved exact Runtime Source:"), "Human-approved source mismatch");
  requireValue(git(root, "rev-parse", "HEAD") === workflowSha, "workflow checkout mismatch");
  requireValue(git(root, "cat-file", "-t", sourceSha) === "commit", "source is not a commit");
  git(root, "merge-base", "--is-ancestor", sourceSha, workflowSha);
  const main = await get("branches/main");
  requireValue(main.protected === true && main.commit?.sha === workflowSha, "current protected main required");
  const reviewedSha = await reviewedHead(get, sourceSha, await get(`pulls/${authority.source_pr}`));
  const currentChecks = await checkRuns(get, workflowSha);
  let workflowReviewedSha = workflowSha;
  if (currentChecks.size === 0) {
    const pulls = await get(`commits/${workflowSha}/pulls?per_page=100`);
    const matches = pulls.filter((pull) => pull.merge_commit_sha === workflowSha && pull.base?.ref === "main");
    requireValue(matches.length === 1, "current workflow merge authority missing");
    workflowReviewedSha = await reviewedHead(get, workflowSha, await get(`pulls/${matches[0].number}`));
  } else {
    requireChecks(currentChecks);
  }
  const current = await get("branches/main");
  requireValue(current.protected === true && current.commit?.sha === workflowSha, "protected main moved");
  return { source_sha: sourceSha, workflow_sha: workflowSha, reviewed_sha: reviewedSha,
    workflow_reviewed_sha: workflowReviewedSha, git_tree: git(root, "rev-parse", `${sourceSha}^{tree}`) };
}

async function main() {
  const [command, root, output] = process.argv.slice(2);
  if (command === "authorize") {
    requireValue(process.env.GITHUB_REPOSITORY === repository && process.env.GITHUB_REF === "refs/heads/main"
      && process.env.GITHUB_EVENT_NAME === "workflow_dispatch", "protected dispatch required");
    const result = await authorize(root, process.env.INPUT_SOURCE_SHA, process.env.GITHUB_SHA);
    for (const [name, value] of Object.entries(result)) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  } else if (command === "validate") {
    requireValue(git(root, "rev-parse", "HEAD") === approvedSource.source_sha, "Runtime Source mismatch");
    const provenance = validateProvenance(root);
    writeFileSync(output, `${JSON.stringify(provenance, null, 2)}\n`);
  } else {
    throw new Error("invalid provenance command");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

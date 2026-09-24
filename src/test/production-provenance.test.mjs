import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { approvedSource, authorize, checkRuns, validateProvenance } from "../../scripts/production-provenance.mjs";

let root;
let authority;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "contact-production-provenance-"));
  authority = structuredClone(approvedSource);
  for (const file of ["package.json", "pnpm-lock.yaml", "vendor/oripa/CONTACT-PREFILL-001"]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(file, join(root, file), { recursive: true });
  }
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

function mutateJson(file, mutation) {
  const path = join(root, file);
  const value = JSON.parse(readFileSync(path, "utf8"));
  mutation(value);
  writeFileSync(path, JSON.stringify(value));
}

function mutateManifest(mutation) {
  mutateJson(authority.manifest_path, mutation);
  authority.manifest_sha256 = createHash("sha256").update(readFileSync(join(root, authority.manifest_path))).digest("hex");
}

describe("exact alpha.38 Production provenance", () => {
  it("accepts approved source pins, immutable artifact identity and every digest", () => {
    expect(validateProvenance(root)).toMatchObject({
      source_sha: "342341a82131a7f80a4e7508172f1e764ec7ad84",
      contract_version: "2.0.0-alpha.38", contract_artifact_id: "10786577343",
      contract_manifest_sha256: "585cb98b83f7396b2f1a214c24c039dfadedc6f29667b471aa5902951045ddd1",
      client_pin: "2.0.0-alpha.38", testkit_pin: "2.0.0-alpha.38", public_openapi_pin: "2.0.0-alpha.34",
      client_sha256: approvedSource.client_sha256, testkit_sha256: approvedSource.testkit_sha256,
      public_openapi_sha256: approvedSource.public_openapi_sha256,
    });
  });

  it.each(["2.0.0-alpha.36", "2.0.0-alpha.37"])("rejects %s source pins", (version) => {
    mutateJson("package.json", (value) => {
      value.dependencies["@oripa/storefront-client"] = `file:vendor/oripa/CONTACT-PREFILL-001/oripa-storefront-client-${version}.tgz`;
    });
    expect(() => validateProvenance(root)).toThrow("source dependency pin mismatch");
  });

  it.each(["2.0.0-alpha.36", "2.0.0-alpha.37"])("rejects %s manifest contract", (version) => {
    mutateManifest((manifest) => { manifest.bundle.version = version; });
    expect(() => validateProvenance(root, authority)).toThrow("source and manifest contract mismatch");
  });

  it("rejects an incorrect Artifact ID in protected metadata", () => {
    authority.artifact_id = "10786577344";
    expect(() => validateProvenance(root, authority)).toThrow("Artifact ID mismatch");
  });

  it("rejects a stale Artifact ID in source provenance", () => {
    const path = join(root, dirname(authority.manifest_path), "PROVENANCE.md");
    writeFileSync(path, readFileSync(path, "utf8").replace("10786577343", "10786577344"));
    expect(() => validateProvenance(root)).toThrow("Artifact ID mismatch");
  });

  it("rejects a wrong manifest digest", () => {
    authority.manifest_sha256 = "0".repeat(64);
    expect(() => validateProvenance(root, authority)).toThrow("manifest digest mismatch");
  });

  it.each(["client", "testkit"])("rejects a mixed %s manifest version", (name) => {
    mutateManifest((manifest) => { manifest.packages.find((entry) => entry.name === `@oripa/storefront-${name}`).version = "2.0.0-alpha.37"; });
    expect(() => validateProvenance(root, authority)).toThrow("Client/Testkit mismatch");
  });

  it("rejects a mismatched Testkit client requirement", () => {
    mutateManifest((manifest) => { manifest.packages.find((entry) => entry.name === "@oripa/storefront-testkit").storefront_client_version = "2.0.0-alpha.37"; });
    expect(() => validateProvenance(root, authority)).toThrow("Client/Testkit mismatch");
  });

  it.each(["oripa-storefront-client-2.0.0-alpha.38.tgz", "oripa-storefront-testkit-2.0.0-alpha.38.tgz", "public.openapi.json"])(
    "rejects changed artifact bytes: %s", (file) => {
      writeFileSync(join(root, dirname(authority.manifest_path), file), "tampered");
      expect(() => validateProvenance(root)).toThrow(/digest mismatch/);
    },
  );

  it("rejects stale AGENCY-004A authority", () => {
    authority.manifest_path = "vendor/oripa/AGENCY-004A/artifact-manifest.json";
    expect(() => validateProvenance(root, authority)).toThrow("stale provenance authority");
  });

  it("rejects a mismatched lockfile pin", () => {
    const path = join(root, "pnpm-lock.yaml");
    writeFileSync(path, readFileSync(path, "utf8").replaceAll("alpha.38", "alpha.37"));
    expect(() => validateProvenance(root)).toThrow("lockfile pin mismatch");
  });

  it("binds validation and manifest to the exact runtime source in the canonical workflow", () => {
    const workflow = readFileSync(".github/workflows/production-artifact.yml", "utf8");
    expect(workflow).not.toContain("AGENCY-004A");
    expect(workflow).not.toContain("alpha.36");
    expect(workflow).not.toContain("alpha.37");
    expect(workflow).toContain("ref: ${{ steps.source.outputs.source_sha }}");
    expect(workflow).toContain("INPUT_SOURCE_SHA: ${{ inputs.source_sha }}");
    expect(workflow).toContain("...provenance,");
    expect(workflow).toContain("Contract provenance source mismatch");
    expect(workflow.match(/Contract provenance mismatch:/g)).toHaveLength(2);
    expect(workflow.indexOf("Validate approved Contract provenance")).toBeLessThan(workflow.indexOf("Build exact production application"));
  });
});

function git(...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const names = ["policy-gate", "quality-gate", "security-gate", "integration-gate", "ci-gate"];
function checks(sha) {
  return { total_count: 5, check_runs: names.map((name, index) => ({
    name, id: index + 1, head_sha: sha, started_at: "2026-09-24T00:00:00Z",
    status: "completed", conclusion: "success",
    app: { id: 15368, slug: "github-actions", owner: { login: "github" } },
  })) };
}

describe("Production source authority", () => {
  let source;
  let workflow;
  let sourceTree;
  let workflowTree;
  const sourceHead = "a".repeat(40);
  const workflowHead = "b".repeat(40);
  let responses;

  beforeEach(() => {
    git("init", "-q");
    git("config", "user.email", "test@example.invalid");
    git("config", "user.name", "Source authority test");
    git("add", ".");
    git("commit", "-qm", "approved source");
    source = git("rev-parse", "HEAD");
    sourceTree = git("rev-parse", "HEAD^{tree}");
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs/production-approved-source.json"), JSON.stringify({ ...approvedSource, source_sha: source }));
    git("add", ".");
    git("commit", "-qm", "workflow authority");
    workflow = git("rev-parse", "HEAD");
    workflowTree = git("rev-parse", "HEAD^{tree}");
    const pull = (sha, head) => ({ merged: true, merge_commit_sha: sha, base: { ref: "main" }, head: { sha: head, repo: { full_name: approvedSource.repository } } });
    responses = {
      "branches/main": { protected: true, commit: { sha: workflow } },
      "pulls/110": pull(source, sourceHead),
      "pulls/111": pull(workflow, workflowHead),
      [`git/commits/${source}`]: { tree: { sha: sourceTree } },
      [`git/commits/${sourceHead}`]: { tree: { sha: sourceTree } },
      [`git/commits/${workflow}`]: { tree: { sha: workflowTree } },
      [`git/commits/${workflowHead}`]: { tree: { sha: workflowTree } },
      [`commits/${workflow}/pulls?per_page=100`]: [{ number: 111, merge_commit_sha: workflow, base: { ref: "main" } }],
    };
  });

  function get(path) {
    if (path in responses) return Promise.resolve(responses[path]);
    if (path.includes("/check-runs?")) {
      const sha = path.split("/")[1];
      return Promise.resolve(sha === workflow ? { total_count: 0, check_runs: [] } : checks(sha));
    }
    throw new Error(path);
  }

  it("accepts reviewed-tree checks when squash checks are empty without changing runtime source", async () => {
    expect(await authorize(root, source, workflow, get)).toMatchObject({
      source_sha: source, workflow_sha: workflow, reviewed_sha: sourceHead, workflow_reviewed_sha: workflowHead,
    });
  });

  it.each(["main", "abc", "A".repeat(40), "0".repeat(40)])("rejects invalid or unapproved source %s", async (sha) => {
    await expect(authorize(root, sha, workflow, get)).rejects.toThrow();
  });

  it("does not substitute current main for approved source", async () => {
    await expect(authorize(root, workflow, workflow, get)).rejects.toThrow("Human-approved source mismatch");
  });

  it("rejects reviewed tree mismatch", async () => {
    responses[`git/commits/${sourceHead}`].tree.sha = workflowTree;
    await expect(authorize(root, source, workflow, get)).rejects.toThrow("reviewed tree mismatch");
  });

  it("does not fall back around failed current checks", async () => {
    const payload = checks(workflow);
    payload.check_runs[0].conclusion = "failure";
    responses[`commits/${workflow}/check-runs?filter=all&per_page=100&page=1`] = payload;
    await expect(authorize(root, source, workflow, get)).rejects.toThrow("required checks not successful");
  });

  it("rejects checks from an untrusted app", async () => {
    const payload = checks(sourceHead);
    payload.check_runs[0].app.id = 1;
    await expect(checkRuns(async () => payload, sourceHead)).rejects.toThrow("check source mismatch");
  });
});

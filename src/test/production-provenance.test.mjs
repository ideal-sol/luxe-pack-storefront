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
  root = mkdtempSync(join(tmpdir(), "alpha45-production-provenance-"));
  authority = structuredClone(approvedSource);
  for (const file of ["vendor/oripa/PREREG-V14-20261016"]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(file, join(root, file), { recursive: true });
  }
  const client = "file:vendor/oripa/PREREG-V14-20261016/oripa-storefront-client-2.0.0-alpha.45.tgz";
  const testkit = "file:vendor/oripa/PREREG-V14-20261016/oripa-storefront-testkit-2.0.0-alpha.45.tgz";
  writeFileSync(join(root, "package.json"), JSON.stringify({
    dependencies: { "@oripa/storefront-client": client },
    devDependencies: { "@oripa/storefront-testkit": testkit },
  }));
  writeFileSync(join(root, "pnpm-lock.yaml"), [
    "lockfileVersion: '9.0'", "importers:", "  .:", "    dependencies:",
    "      '@oripa/storefront-client':", `        specifier: ${client}`, `        version: ${client}`,
    "    devDependencies:", "      '@oripa/storefront-testkit':", `        specifier: ${testkit}`, `        version: ${testkit}`, "",
  ].join("\n"));
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

describe("exact alpha.45 Production provenance", () => {
  it("accepts the retained Human-approved alpha.45 source pins", () => {
    expect(validateProvenance(root).contract_version).toBe("2.0.0-alpha.45");
  });
  it("accepts the fixed application's real package and lockfile pins", () => {
    cpSync("package.json", join(root, "package.json"));
    cpSync("pnpm-lock.yaml", join(root, "pnpm-lock.yaml"));
    expect(validateProvenance(root).contract_version).toBe("2.0.0-alpha.45");
  });

  it("rejects alpha.44 dependencies under the new Production authority", () => {
    mutateJson("package.json", (value) => {
      value.dependencies["@oripa/storefront-client"] = "file:vendor/oripa/SIGNUP-SMS-GATE-20261012/oripa-storefront-client-2.0.0-alpha.44.tgz";
      value.devDependencies["@oripa/storefront-testkit"] = "file:vendor/oripa/SIGNUP-SMS-GATE-20261012/oripa-storefront-testkit-2.0.0-alpha.44.tgz";
    });
    expect(() => validateProvenance(root)).toThrow("source dependency pin mismatch");
  });

  it("rejects the old alpha.44 authority for new source dependencies", () => {
    authority.contract_version = "2.0.0-alpha.44";
    authority.manifest_path = "vendor/oripa/SIGNUP-SMS-GATE-20261012/artifact-manifest.json";
    authority.artifact_id = "11745799489";
    expect(() => validateProvenance(root, authority)).toThrow("stale provenance authority");
  });

  it("rejects alpha.44 authority even with the current directory", () => {
    authority.contract_version = "2.0.0-alpha.44";
    expect(() => validateProvenance(root, authority)).toThrow("unapproved contract version");
  });
  it("rejects predecessor alpha.41 source dependency pins", () => {
    cpSync("src/test/fixtures/production-alpha41/package.json", join(root, "package.json"));
    expect(() => validateProvenance(root)).toThrow("source dependency pin mismatch");
  });

  it("rejects predecessor alpha.40 source dependency pins", () => {
    cpSync("src/test/fixtures/production-alpha40/package.json", join(root, "package.json"));
    expect(() => validateProvenance(root)).toThrow("source dependency pin mismatch");
  });

  it("rejects predecessor alpha.39 source dependency pins", () => {
    cpSync("src/test/fixtures/production-alpha39/package.json", join(root, "package.json"));
    expect(() => validateProvenance(root)).toThrow("source dependency pin mismatch");
  });

  it("accepts approved source pins, immutable artifact identity and every digest", () => {
    expect(validateProvenance(root)).toMatchObject({
      source_sha: "b8417ea3c209f3fc493a7d835f403ae610d60ee2",
      contract_version: "2.0.0-alpha.45", contract_artifact_id: "12031381227",
      contract_manifest_sha256: "0fd03ceb42cf316fc01de0c9757ee20be3bc1242b25cd52bc20870c50c2ce3a5",
      client_pin: "2.0.0-alpha.45", testkit_pin: "2.0.0-alpha.45", public_openapi_pin: "2.0.0-alpha.41",
      platform_runtime_source_sha: "b5c28015ef94cb80f6702a61b1237cacd91d9863",
      platform_authority_merge_sha: "8f9f9a8c9181361a6cbc540b54ddc476ad7fc9d1",
      contract_archive_sha256: "19472639f0fa5afe1aa14663d93587f19f28df8f79e0fa784621d2dffc4054d2",
      platform_source_sha: "c4efbee32a7846bc94f7375d0d5f71779aa0ac77",
      client_sha256: "4a78f26395807fd0eff231249c9f2547d416de4a439309605fee9cd903433c4e",
      testkit_sha256: "8e6577375c864a0681aa475ee39c6c7a0958bc09c754a92cd1252f543b9b2a7a",
      public_openapi_sha256: "9fc089b11f70bc0f3e70d44e41c1ec4b32c7479b6ec24410d0481d45f5b6401f",
    });
  });

  it.each(["2.0.0-alpha.36", "2.0.0-alpha.37", "2.0.0-alpha.38", "2.0.0-alpha.39", "2.0.0-alpha.40", "2.0.0-alpha.41", "2.0.0-alpha.42", "2.0.0-alpha.43", "2.0.0-alpha.44"])("rejects %s source pins", (version) => {
    mutateJson("package.json", (value) => {
      value.dependencies["@oripa/storefront-client"] = `file:vendor/oripa/PREREG-V14-20261016/oripa-storefront-client-${version}.tgz`;
    });
    expect(() => validateProvenance(root)).toThrow("source dependency pin mismatch");
  });

  it.each(["2.0.0-alpha.36", "2.0.0-alpha.37", "2.0.0-alpha.38", "2.0.0-alpha.39", "2.0.0-alpha.40", "2.0.0-alpha.41", "2.0.0-alpha.42", "2.0.0-alpha.43", "2.0.0-alpha.44"])("rejects %s manifest contract", (version) => {
    mutateManifest((manifest) => { manifest.bundle.version = version; });
    expect(() => validateProvenance(root, authority)).toThrow("source and manifest contract mismatch");
  });

  it.each(["platform_runtime_source_sha", "platform_authority_merge_sha"])("rejects wrong %s", (field) => {
    authority[field] = "f".repeat(40);
    expect(() => validateProvenance(root, authority)).toThrow("Platform runtime authority mismatch");
  });

  it.each([
    ["platform_runtime_source_sha", "538a208c025fcc5a7d6f9914d3c428b9ef702dbe"],
    ["platform_authority_merge_sha", "6deba7e8fe4b85ae43b66b7437b46db94ad7c814"],
    ["platform_runtime_source_sha", "cba63981e443992d7b4f9ebcd0ee219dce38c0f9"],
    ["platform_runtime_source_sha", "e4361ece51fc1249a5cfb2c64cf56d3aa4bb0c29"],
    ["platform_authority_merge_sha", "d823c2f80c1500990289b06da8e5504d7b48c2e5"],
  ])("rejects superseded %s", (field, value) => {
    authority[field] = value;
    expect(() => validateProvenance(root, authority)).toThrow("Platform runtime authority mismatch");
  });

  it("keeps artifact source separate from runtime source", () => {
    authority.platform_source_sha = authority.platform_runtime_source_sha;
    expect(() => validateProvenance(root, authority)).toThrow("Platform source mismatch");
  });

  it("rejects wrong outer archive authority", () => {
    authority.contract_archive_sha256 = "0".repeat(64);
    expect(() => validateProvenance(root, authority)).toThrow("Contract archive authority mismatch");
  });

  it.each(["missing", "duplicate", "wrong"])("rejects %s canonical workflow provenance", (kind) => {
    const path = join(root, dirname(authority.manifest_path), "PROVENANCE.md");
    const content = readFileSync(path, "utf8");
    const line = "Publication: https://github.com/ideal-sol/oripa/actions/runs/38866011951, attempt 1, success.";
    writeFileSync(path, kind === "missing" ? content.replace(line, "")
      : kind === "duplicate" ? `${content}\n${line}\n` : content.replace("38866011951", "38247721027"));
    expect(() => validateProvenance(root)).toThrow("Canonical workflow mismatch");
  });

  it.each(["missing", "duplicate"])("rejects %s outer archive provenance", (kind) => {
    const path = join(root, dirname(authority.manifest_path), "PROVENANCE.md");
    const content = readFileSync(path, "utf8");
    const line = `Outer ZIP SHA256: ${authority.contract_archive_sha256}.`;
    writeFileSync(path, kind === "missing" ? content.replace(line, "") : `${content}\n${line}\n`);
    expect(() => validateProvenance(root)).toThrow("Contract archive authority mismatch");
  });

  it.each([
    ["Artifact ID: 12031381227; oripa-storefront-contract-2.0.0-alpha.45.", "alpha.45", "alpha.44", "Artifact ID mismatch"],
    ["Publication: https://github.com/ideal-sol/oripa/actions/runs/38866011951, attempt 1, success.", "attempt 1", "attempt 2", "Canonical workflow mismatch"],
    ["Publication: https://github.com/ideal-sol/oripa/actions/runs/38866011951, attempt 1, success.", "success", "failure", "Canonical workflow mismatch"],
    ["Publication: https://github.com/ideal-sol/oripa/actions/runs/38866011951, attempt 1, success.", "ideal-sol/oripa", "other/repository", "Canonical workflow mismatch"],
  ])("rejects malformed provenance %s (%s)", (line, before, after, error) => {
    const path = join(root, dirname(authority.manifest_path), "PROVENANCE.md");
    writeFileSync(path, readFileSync(path, "utf8").replace(line, line.replace(before, after)));
    expect(() => validateProvenance(root)).toThrow(error);
  });

  it.each([
    ["Artifact ID: invalid", "Artifact ID mismatch"],
    ["- Artifact ID: `11745799489`", "Artifact ID mismatch"],
    ["Publication: invalid", "Canonical workflow mismatch"],
    ["- Workflow: https://github.com/ideal-sol/oripa/actions/runs/38247721027", "Canonical workflow mismatch"],
    ["Outer ZIP SHA256: invalid", "Contract archive authority mismatch"],
    ["| Outer ZIP | `invalid` |", "Contract archive authority mismatch"],
  ])("rejects an additional conflicting declaration %s", (line, error) => {
    const path = join(root, dirname(authority.manifest_path), "PROVENANCE.md");
    writeFileSync(path, `${readFileSync(path, "utf8")}\n${line}\n`);
    expect(() => validateProvenance(root)).toThrow(error);
  });

  it("rejects incorrect outer ZIP bytes evidence without falling back", () => {
    const path = join(root, dirname(authority.manifest_path), "PROVENANCE.md");
    writeFileSync(path, readFileSync(path, "utf8").replace(authority.contract_archive_sha256, "0".repeat(64)));
    expect(() => validateProvenance(root)).toThrow("Contract archive authority mismatch");
  });

  it("rejects wrong Public OpenAPI version", () => {
    mutateManifest((manifest) => { manifest.public_openapi.version = "2.0.0-alpha.35"; });
    expect(() => validateProvenance(root, authority)).toThrow("Public OpenAPI digest mismatch");
  });

  it("rejects an incorrect Artifact ID in protected metadata", () => {
    authority.artifact_id = "10786577344";
    expect(() => validateProvenance(root, authority)).toThrow("Artifact ID mismatch");
  });

  it("rejects a stale Artifact ID in source provenance", () => {
    const path = join(root, dirname(authority.manifest_path), "PROVENANCE.md");
    writeFileSync(path, readFileSync(path, "utf8").replace("12031381227", "10786577344"));
    expect(() => validateProvenance(root)).toThrow("Artifact ID mismatch");
  });

  it("rejects a wrong manifest digest", () => {
    authority.manifest_sha256 = "0".repeat(64);
    expect(() => validateProvenance(root, authority)).toThrow("manifest digest mismatch");
  });

  it("rejects alpha.38 authority even with the current artifact directory", () => {
    authority.contract_version = "2.0.0-alpha.38";
    expect(() => validateProvenance(root, authority)).toThrow("unapproved contract version");
  });

  it("rejects the old Platform source", () => {
    authority.platform_source_sha = "e16f65504dc5286de2fcd70988b770d1a16d1eaf";
    expect(() => validateProvenance(root, authority)).toThrow("Platform source mismatch");
  });

  it("rejects a mismatched manifest Platform source", () => {
    mutateManifest((manifest) => { manifest.source_commit = "f".repeat(40); });
    expect(() => validateProvenance(root, authority)).toThrow("Platform source mismatch");
  });

  it("rejects a mutable manifest", () => {
    mutateManifest((manifest) => { manifest.bundle.immutable = false; });
    expect(() => validateProvenance(root, authority)).toThrow("source and manifest contract mismatch");
  });

  it.each(["client", "testkit"])("rejects an incorrect %s authority digest", (name) => {
    authority[`${name}_sha256`] = "0".repeat(64);
    expect(() => validateProvenance(root, authority)).toThrow("Client/Testkit mismatch");
  });

  it("rejects an incorrect Public OpenAPI authority digest", () => {
    authority.public_openapi_sha256 = "0".repeat(64);
    expect(() => validateProvenance(root, authority)).toThrow("Public OpenAPI digest mismatch");
  });

  it.each(["sha256", "file"])("rejects a mismatched Public OpenAPI manifest %s", (field) => {
    mutateManifest((manifest) => { manifest.public_openapi[field] = "wrong"; });
    expect(() => validateProvenance(root, authority)).toThrow("Public OpenAPI digest mismatch");
  });

  it.each(["missing", "duplicate"])("rejects %s Artifact ID evidence", (kind) => {
    const path = join(root, dirname(authority.manifest_path), "PROVENANCE.md");
    const content = readFileSync(path, "utf8");
    writeFileSync(path, kind === "missing" ? "missing" : `${content}\n${content}`);
    expect(() => validateProvenance(root)).toThrow("Artifact ID mismatch");
  });

  it.each(["client", "testkit"])("rejects a mixed %s manifest version", (name) => {
    mutateManifest((manifest) => { manifest.packages.find((entry) => entry.name === `@oripa/storefront-${name}`).version = "2.0.0-alpha.37"; });
    expect(() => validateProvenance(root, authority)).toThrow("Client/Testkit mismatch");
  });

  it("rejects a mismatched Testkit client requirement", () => {
    mutateManifest((manifest) => { manifest.packages.find((entry) => entry.name === "@oripa/storefront-testkit").storefront_client_version = "2.0.0-alpha.37"; });
    expect(() => validateProvenance(root, authority)).toThrow("Client/Testkit mismatch");
  });

  it.each(["oripa-storefront-client-2.0.0-alpha.45.tgz", "oripa-storefront-testkit-2.0.0-alpha.45.tgz", "public.openapi.json"])(
    "rejects changed artifact bytes: %s", (file) => {
      writeFileSync(join(root, dirname(authority.manifest_path), file), "tampered");
      expect(() => validateProvenance(root)).toThrow(/digest mismatch/);
    },
  );

  it.each(["AGENCY-004A", "CONTACT-PREFILL-001", "DRAW-20260925", "SHIPONLY-20260926"])("rejects stale %s authority", (directory) => {
    authority.manifest_path = `vendor/oripa/${directory}/artifact-manifest.json`;
    expect(() => validateProvenance(root, authority)).toThrow("stale provenance authority");
  });

  it("rejects a mismatched lockfile pin", () => {
    const path = join(root, "pnpm-lock.yaml");
    writeFileSync(path, readFileSync(path, "utf8").replaceAll("alpha.45", "alpha.41"));
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
      [`pulls/${approvedSource.source_pr}`]: pull(source, sourceHead),
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

  it.each(["main", "abc", "A".repeat(40), "0".repeat(40), "f".repeat(40),
    "7da93eb695f38b7cf804eba59a3642da0b9dc073",
    "342341a82131a7f80a4e7508172f1e764ec7ad84", "b85afec9aba0e72732366e8e12701cef39a06e06"])("rejects invalid or unapproved source %s", async (sha) => {
    await expect(authorize(root, sha, workflow, get)).rejects.toThrow();
  });

  it("does not substitute current main for approved source", async () => {
    await expect(authorize(root, workflow, workflow, get)).rejects.toThrow("Human-approved source mismatch");
  });

  it("rejects main advancing during authorization without changing the fixed source", async () => {
    let mainReads = 0;
    const movingMain = (path) => {
      if (path === "branches/main" && ++mainReads > 1) {
        return Promise.resolve({ protected: true, commit: { sha: "c".repeat(40) } });
      }
      return get(path);
    };
    await expect(authorize(root, source, workflow, movingMain)).rejects.toThrow("protected main moved");
  });

  it("rejects a nonexistent SHA even when named in metadata", async () => {
    const missing = "f".repeat(40);
    mutateJson("docs/production-approved-source.json", (value) => { value.source_sha = missing; });
    git("add", ".");
    git("commit", "-qm", "nonexistent source metadata");
    await expect(authorize(root, missing, git("rev-parse", "HEAD"), get)).rejects.toThrow();
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

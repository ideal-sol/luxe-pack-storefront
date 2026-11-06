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
  root = mkdtempSync(join(tmpdir(), "alpha50-production-provenance-"));
  authority = structuredClone(approvedSource);
  for (const file of ["vendor/oripa/EXCHANGEONLY-ALPHA50-20261104"]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(file, join(root, file), { recursive: true });
  }
  const client = "file:vendor/oripa/EXCHANGEONLY-ALPHA50-20261104/oripa-storefront-client-2.0.0-alpha.50.tgz";
  const testkit = "file:vendor/oripa/EXCHANGEONLY-ALPHA50-20261104/oripa-storefront-testkit-2.0.0-alpha.50.tgz";
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

describe("exact alpha.50 Production provenance", () => {
  it("pins the Human-approved PR226 GTM Runtime Source independently of Workflow/main without Activation GO", () => {
    expect(approvedSource.source_sha).toBe("8e9df3501e5451523a56e57aa1149e6290b92aee");
    expect(approvedSource.source_pr).toBe(226);
    expect(approvedSource.source_sha).not.toBe("1e3ba92780825a12485f651ea79025ad47f1321b");
    expect(approvedSource.authority).toContain("e6c11382199c63f51c1770bf7c1d0ff63654d427");
    expect(approvedSource.authority).toContain("GTM-5DQRPNN2");
    expect(approvedSource.activation_authorized).toBe(false);
    expect(approvedSource.source_sha).not.toBe("7dc355d3174bdf8a4731741eea7aa4a80752b724");
    expect(approvedSource.source_sha).not.toBe("9702793ec7fdad4332e634b230dc6661ff176655");
    expect(approvedSource.authority.startsWith("Human-approved exact Runtime Source:")).toBe(true);
    expect(approvedSource.authority).toContain("Storefront Authority merge requires separate explicit Human approval");
    expect(approvedSource.authority).not.toContain("Formal Human Source GO is NOT ISSUED");
    expect(approvedSource.authority).not.toContain("Draft candidate exact Runtime Source:");
    expect(approvedSource.platform_authority_merge_sha).toBe("8eadec09a187e3f220dc09d36e9a14b98511931b");
    expect(approvedSource.authority).not.toContain("PR #186 GTM is excluded");
  });

  it("rejects the previous alpha.45 authority directory", () => {
    authority.contract_version = "2.0.0-alpha.45";
    authority.manifest_path = "vendor/oripa/PREREG-V14-20261016/artifact-manifest.json";
    expect(() => validateProvenance(root, authority)).toThrow("stale provenance authority");
  });


  it("accepts formally approved alpha.50 pins without granting Activation GO", () => {
    expect(validateProvenance(root).contract_version).toBe("2.0.0-alpha.50");
  });
  it("rejects superseded alpha.46 source pins under approved alpha.50 authority", () => {
    mutateJson("package.json", (value) => {
      value.dependencies["@oripa/storefront-client"] = "file:vendor/oripa/SHIPPINGMIN-20261023/oripa-storefront-client-2.0.0-alpha.46.tgz";
      value.devDependencies["@oripa/storefront-testkit"] = "file:vendor/oripa/SHIPPINGMIN-20261023/oripa-storefront-testkit-2.0.0-alpha.46.tgz";
    });
    expect(() => validateProvenance(root)).toThrow("source dependency pin mismatch");
  });
  it("rejects predecessor alpha.45 source pins under alpha.50 authority", () => {
    mutateJson("package.json", (value) => {
      value.dependencies["@oripa/storefront-client"] = "file:vendor/oripa/PREREG-V14-20261016/oripa-storefront-client-2.0.0-alpha.45.tgz";
      value.devDependencies["@oripa/storefront-testkit"] = "file:vendor/oripa/PREREG-V14-20261016/oripa-storefront-testkit-2.0.0-alpha.45.tgz";
    });
    expect(() => validateProvenance(root)).toThrow("source dependency pin mismatch");
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
      source_sha: "8e9df3501e5451523a56e57aa1149e6290b92aee",
      contract_version: "2.0.0-alpha.50", contract_artifact_id: "13324454382",
      contract_manifest_sha256: "bbf4284afc47d912a13b039b7a3168fc09ae58ace682c005ef46d852e0b9c44a",
      client_pin: "2.0.0-alpha.50", testkit_pin: "2.0.0-alpha.50", public_openapi_pin: "2.0.0-alpha.46",
      platform_runtime_source_sha: "cad8be03cbab8b7fba18825a4a9b2a276f402010",
      platform_authority_merge_sha: "8eadec09a187e3f220dc09d36e9a14b98511931b",
      contract_archive_sha256: "67d9fbbe7c31fcfaa2ed674eeb4e35d5d60a07e01f0bb0ce34523e4783037b75",
      platform_source_sha: "14f7819c72c5908aa6e5778303b87dc4b1202493",
      client_sha256: "ce09af8175331cb534f031987770744109ccd422f966c367f9c2038a0dda98c3",
      testkit_sha256: "369aad933f312e00a2e6d121cb44d8ee4054e03c46b053c5f4e1f3b5cd955ee9",
      public_openapi_sha256: "c5cbb72aa0b5a2fa8a76d9e034ae223d2209ea468dcba68de8a8dad2b58eb2a3",
    });
  });

  it.each(["2.0.0-alpha.36", "2.0.0-alpha.37", "2.0.0-alpha.38", "2.0.0-alpha.39", "2.0.0-alpha.40", "2.0.0-alpha.41", "2.0.0-alpha.42", "2.0.0-alpha.43", "2.0.0-alpha.44", "2.0.0-alpha.45", "2.0.0-alpha.46", "2.0.0-alpha.47", "2.0.0-alpha.48", "2.0.0-alpha.49"])("rejects %s source pins", (version) => {
    mutateJson("package.json", (value) => {
      value.dependencies["@oripa/storefront-client"] = `file:vendor/oripa/EXCHANGEONLY-ALPHA50-20261104/oripa-storefront-client-${version}.tgz`;
    });
    expect(() => validateProvenance(root)).toThrow("source dependency pin mismatch");
  });

  it.each(["2.0.0-alpha.36", "2.0.0-alpha.37", "2.0.0-alpha.38", "2.0.0-alpha.39", "2.0.0-alpha.40", "2.0.0-alpha.41", "2.0.0-alpha.42", "2.0.0-alpha.43", "2.0.0-alpha.44", "2.0.0-alpha.45", "2.0.0-alpha.46", "2.0.0-alpha.47", "2.0.0-alpha.48", "2.0.0-alpha.49"])("rejects %s manifest contract", (version) => {
    mutateManifest((manifest) => { manifest.bundle.version = version; });
    expect(() => validateProvenance(root, authority)).toThrow("source and manifest contract mismatch");
  });

  it.each(["platform_runtime_source_sha", "platform_authority_merge_sha"])("rejects wrong %s", (field) => {
    authority[field] = "f".repeat(40);
    expect(() => validateProvenance(root, authority)).toThrow("Platform runtime authority mismatch");
  });

  it.each([
    ["platform_runtime_source_sha", "b5c28015ef94cb80f6702a61b1237cacd91d9863"],
    ["platform_authority_merge_sha", "8f9f9a8c9181361a6cbc540b54ddc476ad7fc9d1"],
    ["platform_authority_merge_sha", "PENDING_HUMAN_SOURCE_GO"],
    ["platform_authority_merge_sha", "0372d25ea61a4e6f15485568819f8f1029443b73"],
    ["platform_authority_merge_sha", "14f7819c72c5908aa6e5778303b87dc4b1202493"],
    ["platform_authority_merge_sha", "1086d776"],
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
    authority.platform_source_sha = "0".repeat(40);
    expect(() => validateProvenance(root, authority)).toThrow("Platform source mismatch");
  });

  it.each([undefined, "14f7819c72c5908aa6e5778303b87dc4b1202493", "a6affd68253a0bb162fb480159778f4c79dd51ab"])("rejects missing, base-only or full PR666 runtime source %s", (value) => {
    authority.platform_runtime_source_sha = value;
    expect(() => validateProvenance(root, authority)).toThrow("Platform runtime authority mismatch");
  });

  it.each([undefined, "5ade57a7d40830a2cf137552f242a2001724b295", "3eee947ba34a6af55a1c396dbb14bb4032d14127"])("rejects missing, obsolete or reviewed-head Platform authority %s", (value) => {
    authority.platform_authority_merge_sha = value;
    expect(() => validateProvenance(root, authority)).toThrow("Platform runtime authority mismatch");
  });

  it("retains the contract publisher independently of the derived runtime", () => {
    expect(validateProvenance(root).platform_source_sha).toBe("14f7819c72c5908aa6e5778303b87dc4b1202493");
    authority.platform_source_sha = approvedSource.platform_runtime_source_sha;
    expect(() => validateProvenance(root, authority)).toThrow("Platform source mismatch");
  });

  it("rejects wrong outer archive authority", () => {
    authority.contract_archive_sha256 = "0".repeat(64);
    expect(() => validateProvenance(root, authority)).toThrow("Contract archive authority mismatch");
  });

  it.each([
    "https://github.com/ideal-sol/oripa/actions/runs/41835790272/artifacts/13324454382",
    "Source 14f7819c72c5908aa6e5778303b87dc4b1202493; ledger main7587539aa7104db60203775c0a5813b5c8d291de.",
    `Workflow41835790272; Artifact13324454382; outer${approvedSource.contract_archive_sha256}.`,
    "Client/Testkit2.0.0-alpha.50; predecessor2.0.0-alpha.49; Public/Admin2.0.0-alpha.46; Webhook2.0.0-alpha.45; Site Schema2.0.0-alpha.23.",
    "Task BANNER-MODEL-20261104",
  ])("rejects missing, duplicate or modified authentic declaration %s", (line) => {
    const path = join(root, dirname(authority.manifest_path), "PROVENANCE.md");
    const content = readFileSync(path, "utf8");
    expect(content).toContain(line);
    for (const mutation of [content.replace(line, ""), `${content}\n${line}\n`, content.replace(line, `${line}tampered`)]) {
      writeFileSync(path, mutation);
      expect(() => validateProvenance(root)).toThrow("Formal alpha.50 provenance digest mismatch");
    }
  });

  it.each(["Artifact ID: invalid", "- Artifact ID: `11745799489`", "Publication: invalid",
    "- Workflow: https://github.com/ideal-sol/oripa/actions/runs/38247721027",
    "Outer ZIP SHA256: invalid", "| Outer ZIP | `invalid` |"])("rejects appended legacy declaration %s", (line) => {
    const path = join(root, dirname(authority.manifest_path), "PROVENANCE.md");
    writeFileSync(path, `${readFileSync(path, "utf8")}\n${line}\n`);
    expect(() => validateProvenance(root)).toThrow("Formal alpha.50 provenance digest mismatch");
  });

  it.each(["41835790272", "13324454382", approvedSource.contract_archive_sha256])("rejects altered evidence identity %s", (value) => {
    const path = join(root, dirname(authority.manifest_path), "PROVENANCE.md");
    writeFileSync(path, readFileSync(path, "utf8").replaceAll(value, "0".repeat(value.length)));
    expect(() => validateProvenance(root)).toThrow("Formal alpha.50 provenance digest mismatch");
  });

  it("rejects changed SHA256SUMS", () => {
    writeFileSync(join(root, dirname(authority.manifest_path), "SHA256SUMS"), "tampered");
    expect(() => validateProvenance(root)).toThrow("SHA256SUMS digest mismatch");
  });

  it("rejects a rewritten manifest even if metadata supplies its new digest", () => {
    mutateManifest((manifest) => { manifest.generated_at = "2099-01-01T00:00:00Z"; });
    expect(() => validateProvenance(root, authority)).toThrow("unapproved formal manifest digest");
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
    writeFileSync(path, readFileSync(path, "utf8").replace("13324454382", "10786577344"));
    expect(() => validateProvenance(root)).toThrow("Formal alpha.50 provenance digest mismatch");
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
    expect(() => validateProvenance(root)).toThrow("Formal alpha.50 provenance digest mismatch");
  });

  it.each(["client", "testkit"])("rejects a mixed %s manifest version", (name) => {
    mutateManifest((manifest) => { manifest.packages.find((entry) => entry.name === `@oripa/storefront-${name}`).version = "2.0.0-alpha.37"; });
    expect(() => validateProvenance(root, authority)).toThrow("Client/Testkit mismatch");
  });

  it("rejects a mismatched Testkit client requirement", () => {
    mutateManifest((manifest) => { manifest.packages.find((entry) => entry.name === "@oripa/storefront-testkit").storefront_client_version = "2.0.0-alpha.37"; });
    expect(() => validateProvenance(root, authority)).toThrow("Client/Testkit mismatch");
  });

  it.each(["oripa-storefront-client-2.0.0-alpha.50.tgz", "oripa-storefront-testkit-2.0.0-alpha.50.tgz", "public.openapi.json"])(
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
    writeFileSync(path, readFileSync(path, "utf8").replaceAll("alpha.50", "alpha.41"));
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
    // Test the actual formal approval text with a synthetic local Source SHA.
    writeFileSync(join(root, "docs/production-approved-source.json"), JSON.stringify({
      ...approvedSource, source_sha: source,
    }));
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

  it("still rejects an unapproved Draft authority before any GitHub authority lookup", async () => {
    mutateJson("docs/production-approved-source.json", (value) => {
      value.authority = "Draft candidate exact Runtime Source: synthetic unapproved fixture; Formal Human Source GO is NOT ISSUED";
    });
    git("add", ".");
    git("commit", "-qm", "unapproved Draft candidate");
    let consulted = false;
    await expect(authorize(root, source, git("rev-parse", "HEAD"), async () => {
      consulted = true;
      throw new Error("must not consult GitHub for an unapproved candidate");
    })).rejects.toThrow("Human-approved source mismatch");
    expect(consulted).toBe(false);
  });

  it.each(["1e3ba92780825a12485f651ea79025ad47f1321b", "main", "abc", "A".repeat(40), "0".repeat(40), "f".repeat(40),
    "dcde7c91926d725a69b305e7bd9cc9b48d5d4fe6",
    "00e10604ee262470a96f4c392d2c3b4f2511e98a", "cc398cc4d943f4a426fa9540cc6258edf9bc5208",
    "7dc355d3174bdf8a4731741eea7aa4a80752b724", "9702793ec7fdad4332e634b230dc6661ff176655",
    "7da93eb695f38b7cf804eba59a3642da0b9dc073",
    "342341a82131a7f80a4e7508172f1e764ec7ad84", "b85afec9aba0e72732366e8e12701cef39a06e06"])("rejects invalid or nonmatching fixture source %s", async (sha) => {
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

  it.each(["unmerged", "wrong merge SHA", "wrong base"])("rejects an incorrect source PR: %s", async (kind) => {
    const pull = responses[`pulls/${approvedSource.source_pr}`];
    if (kind === "unmerged") pull.merged = false;
    if (kind === "wrong merge SHA") pull.merge_commit_sha = "f".repeat(40);
    if (kind === "wrong base") pull.base.ref = "other";
    await expect(authorize(root, source, workflow, get)).rejects.toThrow("merged source PR mismatch");
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

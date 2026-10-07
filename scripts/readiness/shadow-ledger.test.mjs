// @vitest-environment node
// Every Human record here is a synthetic test fixture, never operational evidence.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { classifyDiff, defaultPolicy, defaultImpact } from "./classifier.mjs";
import { AUTHORITY, BINDING, CHECKS, IDENTITY, REPOSITORY, SHADOW_CHECK, MACHINE_POLICY_AUTHORITY_START, OPERATIONAL_SHADOW_MEASUREMENT_START, OPERATIONAL_SHADOW_MEASUREMENT_STARTED_AT, canonical, pick, seal } from "./shadow-common.mjs";
import { commentEvidence, finalize, observe, plannedItems, validateEnvelope, validateObservation } from "./shadow-observation.mjs";
import { auditWindow, categoryFor, collectHistoricalRows } from "./shadow-window-audit.mjs";
import { evaluateExit } from "./shadow-exit-evaluator.mjs";
import { runInvalidation, validateInvalidation } from "./shadow-invalidation.mjs";
import { collectWindow, recordsFromComments } from "./shadow-github-adapter.mjs";
import { PUBLISHER_SNAPSHOT_VERSION, TRUSTED_SHADOW_EVIDENCE_PUBLISHERS, resolutionCommentEvidence } from "./shadow-publisher.mjs";

const now = "2026-10-07T05:20:00.000Z";
const beforeStart = "2026-10-06T00:00:00.000Z";
const afterStart = "2026-10-07T05:10:00.000Z";
const sha = number => number.toString(16).padStart(40, "0");
let proof;
beforeAll(async () => { proof = await runInvalidation(); });

async function fixture(number = 200, kind = "copy") {
  const path = kind === "css" ? "src/styles/globals.css" : "src/components/payment/card-save-confirmation.tsx";
  const before = kind === "css" ? ".title { color: red; }" : kind === "style" ? "export const View = () => <p style={{ color: 'red' }}>Hello</p>;" : "export const View = () => <p>Hello</p>;";
  const after = kind === "css" || kind === "style" ? before.replace("red", "blue") : kind === "dynamic" ? "export const View = () => <p className={theme}>Hello</p>;" : before.replace("Hello", "Welcome");
  const machine = await classifyDiff({ base_sha: sha(1), head_sha: sha(number), tree_sha: sha(number + 1000), complete_diff: true, baseline_matches: true, platform_impact: "NONE",
    changes: [{ path, status: "M", old_mode: "100644", new_mode: "100644", before: Buffer.from(before), after: Buffer.from(after) }],
    base_sources: { [path]: before }, head_sources: { [path]: after } });
  const envelope = observe(machine, number, now);
  const human = seal({ schema_version: "1.0", ...pick(envelope, BINDING), confirmed_by_role: "human_operator", evidence_reference: "https://example.test/human/fixture-only",
    platform_impact_ground_truth: "NONE", minor_eligibility_ground_truth: kind === "dynamic" ? "NOT_MINOR" : "ELIGIBLE_MINOR",
    actual_change_qualifier: true, change_kind: "REAL_STOREFRONT", critical_path: kind !== "css", presentation_only_confirmed: kind !== "dynamic",
    focused_acceptance_result: { plan_digest: machine.browser_acceptance_plan?.record_digest ?? null, planned_items: plannedItems(machine), performed_items: plannedItems(machine), missed_items: [], acceptance_complete: true, evidence_reference: "https://example.test/acceptance/fixture-only" },
    focused_acceptance_misses: [], normal_ci_comparison: "PASS",
    fail_closed_observation: { status: kind === "dynamic" ? "PASS" : "NOT_OBSERVED", cases: kind === "dynamic" ? ["dynamic className"] : [], evidence_reference: kind === "dynamic" ? "https://example.test/fail-closed/fixture-only" : null }, human_notes: "SYNTHETIC TEST ONLY" });
  const checks = seal({ schema_version: "1.0", ...pick(envelope, IDENTITY), evidence_reference: "https://example.test/checks/fixture-only",
    checks: [...CHECKS, SHADOW_CHECK].map(name => ({ name, conclusion: "success", source_head_sha: envelope.head_sha, evidence_reference: `https://example.test/checks/${name}` })) });
  return { machine, envelope, human, checks, record: finalize(envelope, human, checks, now), path };
}

function published(record, kind = "observation", login = "myong-ideal", prNumber = record.pr_number, id = 10000 + record.pr_number, type = "issue_comment") {
  return { id, user: { login }, html_url: `https://github.com/${REPOSITORY}/pull/${prNumber}#${type === "issue_comment" ? "issuecomment" : "pullrequestreview"}-${id}`,
    body: kind === "observation" ? commentEvidence(record) : resolutionCommentEvidence(record) };
}
function publication(record, kind = "observation") {
  return recordsFromComments([published(record, kind)], record.pr_number, kind).provenance;
}
function withResolutions(window, resolutions) {
  return modified(window, w => {
    for (const record of resolutions) {
      const row = w.pull_requests.find(row => row.pr_number === record.pr_number);
      row.resolution_record_digests.push(record.record_digest);
      row.durable_evidence.push(...publication(record, "resolution"));
    }
  });
}
function windowFor(records, paths = {}) {
  return seal({ schema_version: PUBLISHER_SNAPSHOT_VERSION, repository: REPOSITORY, authority: AUTHORITY, start_authority: MACHINE_POLICY_AUTHORITY_START,
    started_at: "2026-10-05T10:00:00.000Z", captured_at: now, protected_main: true, protected_main_sha: sha(999), start_is_ancestor: true,
    measurement_start_authority: OPERATIONAL_SHADOW_MEASUREMENT_START,
    measurement_started_at: OPERATIONAL_SHADOW_MEASUREMENT_STARTED_AT, measurement_start_is_ancestor: true, historical_rows: [],
    index_complete: true, pagination_complete: true, evidence_reference: "https://example.test/window/fixture-only",
    pull_requests: records.map(record => ({ ...pick(record, IDENTITY), base_ref: "main", state: "merged", created_at: afterStart, updated_at: now, merged_at: now, closed_at: now, merge_commit_sha: sha(record.pr_number + 2000),
      changed_files: paths[record.pr_number] ?? ["src/components/payment/card-save-confirmation.tsx"], files_complete: true,
      shadow_workflow_triggered: true, shadow_check_conclusion: "success", shadow_source_head_sha: record.head_sha, shadow_evidence_reference: "https://example.test/shadow",
      measurement_evidence: { run: { id: record.pr_number, created_at: record.generated_at, updated_at: now,
        head_sha: record.head_sha, event: "pull_request", path: ".github/workflows/readiness-shadow.yml", html_url: "https://example.test/shadow" },
        observations: [{ ...pick(record, IDENTITY), machine_record_digest: record.machine_record_digest, generated_at: record.generated_at,
          source: "artifact", artifact_id: record.pr_number, run_id: record.pr_number }] },
      normal_ci_conclusions: Object.fromEntries(record.check_evidence.checks.filter(check => CHECKS.includes(check.name)).map(check => [check.name, check.conclusion])),
      durable_evidence: publication(record), resolution_record_digests: [],
      observation_artifact_exists: true, machine_record_digests: [record.machine_record_digest], finalized_record_digests: [record.record_digest], historical_finalized_record_digests: [record.record_digest] })) });
}
function modified(value, mutate) { const next = structuredClone(value); mutate(next); return seal(next); }
function resolution(record, finding = record.findings[0]) {
  return seal({ schema_version: "1.0", ...pick(record, BINDING), observation_digest: record.record_digest, finding_id: finding.finding_id, status: "RESOLVED", confirmed_by_role: "human_operator", resolution_reference: "https://example.test/human-resolution", });
}

describe("sealed observations and separate Human ground truth", () => {
  it("finalizes exact evidence, preserves lanes, round-trips durable comments", async () => {
    const { envelope, record } = await fixture();
    expect(envelope.status).toBe("PENDING_HUMAN"); expect(envelope).not.toHaveProperty("human_evidence");
    expect(validateObservation(record)).toEqual(record); expect(record.status).toBe("FINALIZED");
    expect(record.machine_vs_human).toBe("AGREEMENT"); expect(record.machine_minor_candidate).toBe(true);
    expect(record.candidate_lane).toBe(envelope.machine.candidate_lane);
    expect(recordsFromComments([published(record)], record.pr_number).records).toEqual([record]);
  });
  it("produces FP and FN findings OPEN, never self-resolves", async () => {
    const f = await fixture();
    const fp = finalize(f.envelope, modified(f.human, h => { h.minor_eligibility_ground_truth = "NOT_MINOR"; }), f.checks, now);
    expect(fp.machine_vs_human).toBe("FALSE_POSITIVE"); expect(fp.findings[0].status).toBe("OPEN");
    const g = await fixture(201, "dynamic");
    const fn = finalize(g.envelope, modified(g.human, h => { h.minor_eligibility_ground_truth = "ELIGIBLE_MINOR"; }), g.checks, now);
    expect(fn.machine_vs_human).toBe("FALSE_NEGATIVE"); expect(fn.findings[0].status).toBe("OPEN");
    expect(evaluateExit([fn], windowFor([fn])).conditions.false_negative).toBe(false);
  });
  it.each(["acceptance", "platform", "truth", "ci"])("incomplete %s is NOT_COMPARABLE and gets no credit", async field => {
    const f = await fixture(201, "dynamic");
    const human = modified(f.human, h => {
      h.minor_eligibility_ground_truth = "ELIGIBLE_MINOR";
      if (field === "acceptance") h.focused_acceptance_result.acceptance_complete = false;
      if (field === "platform") h.platform_impact_ground_truth = "UNKNOWN";
      if (field === "truth") h.minor_eligibility_ground_truth = "NOT_COMPARABLE";
      if (field === "ci") h.normal_ci_comparison = "NOT_COMPARABLE";
    });
    const record = finalize(f.envelope, human, f.checks, now);
    expect(record.machine_vs_human).toBe("NOT_COMPARABLE"); expect(record.false_negative).toBe(false);
    expect(evaluateExit([record], windowFor([record])).counts.qualifying_actual_changes).toBe(0);
  });
  it.each(["base_sha", "head_sha", "tree_sha", "policy_digest", "impact_map_digest", "machine_record_digest"])("rejects mismatched Human %s", async key => {
    const f = await fixture();
    expect(() => finalize(f.envelope, modified(f.human, h => { h[key] = "wrong"; }), f.checks)).toThrow(/MISMATCH/);
  });
  it.each(["machine", "human", "final"])("rejects tampered %s digest", async target => {
    const f = await fixture();
    if (target === "machine") { f.envelope.machine.classification_reason = "TAMPERED"; expect(() => validateEnvelope(seal(f.envelope))).toThrow("MACHINE_RECORD_DIGEST_MISMATCH"); }
    if (target === "human") { f.human.human_notes = "TAMPERED"; expect(() => finalize(f.envelope, f.human, f.checks)).toThrow("HUMAN_DIGEST_MISMATCH"); }
    if (target === "final") { f.record.actual_change_qualifier = false; expect(() => validateObservation(f.record)).toThrow("OBSERVATION_DIGEST_MISMATCH"); }
  });
  it("rejects re-sealed derived fields, Machine policy override and missing Human evidence", async () => {
    const f = await fixture();
    expect(() => validateObservation(modified(f.record, r => { r.machine_vs_human = "FALSE_NEGATIVE"; }))).toThrow("OBSERVATION_DERIVATION_MISMATCH");
    expect(() => finalize(f.envelope, modified(f.human, h => { h.machine_policy = {}; }), f.checks)).toThrow("HUMAN_FIELDS_INVALID");
    expect(() => finalize(f.envelope, null, f.checks)).toThrow();
    expect(() => finalize(f.envelope, modified(f.human, h => { h.confirmed_by_role = "machine"; }), f.checks)).toThrow("HUMAN_EVIDENCE_REQUIRED");
    expect(() => finalize(f.envelope, modified(f.human, h => { delete h.focused_acceptance_result; }), f.checks)).toThrow();
    expect(() => finalize(f.envelope, modified(f.human, h => { h.focused_acceptance_result.performed_items = []; }), f.checks)).toThrow("ACCEPTANCE_INCOMPLETE");
    expect(() => finalize(f.envelope, modified(f.human, h => { h.focused_acceptance_result.planned_items = []; }), f.checks)).toThrow("PLANNED_ITEMS_MISMATCH");
  });
  it.each(["missing", "duplicate", "head", "failure"])("rejects %s CI evidence", async kind => {
    const f = await fixture();
    const checks = modified(f.checks, c => {
      if (kind === "missing") c.checks.pop();
      if (kind === "duplicate") c.checks.push(c.checks[0]);
      if (kind === "head") c.checks[0].source_head_sha = sha(999);
      if (kind === "failure") c.checks[0].conclusion = "failure";
    });
    expect(() => finalize(f.envelope, f.human, checks)).toThrow();
  });
  it("requires explicit Human fail-closed confirmation and excludes non-actual work", async () => {
    const f = await fixture();
    const human = modified(f.human, h => { h.fail_closed_observation = { status: "PASS", cases: ["unknown"], evidence_reference: "ref" }; });
    expect(() => finalize(f.envelope, human, f.checks)).toThrow("FAIL_CLOSED_CONTRADICTION");
    for (const kind of ["GATE_TOOLING", "SYNTHETIC", "TEST_ONLY", "DOCS_ONLY", "CI_ONLY", "SECURITY_OR_DEPENDENCY_ONLY"]) {
      expect(() => finalize(f.envelope, modified(f.human, h => { h.change_kind = kind; }), f.checks)).toThrow("NON_ACTUAL_CHANGE");
    }
    expect(evaluateExit([f.record], windowFor([f.record])).conditions.fail_closed).toBe(false);
  });
});

describe("formal Exit aggregation", () => {
  async function five() { return Promise.all([fixture(200), fixture(201, "css"), fixture(202, "style"), fixture(203), fixture(204, "dynamic")]); }
  it("requires five actual PRs, three classes, critical presentation, reuse and controlled invalidation", async () => {
    const records = (await five()).map(f => f.record);
    const result = evaluateExit(records, windowFor(records), { invalidation: proof });
    expect(result.status).toBe("SHADOW_EXIT_CANDIDATE");
    expect(result.counts.qualifying_actual_changes).toBe(5); expect(result.counts.distinct_change_classes).toBe(3);
    expect(result.counts.critical_file_presentation_only).toBeGreaterThan(0);
    expect(result.conditions.authority_reuse).toBe(true); expect(result.conditions.authority_invalidation).toBe(true);
    expect(result.blocking_authority).toBe(false); expect(result.fast_lane_production_enabled).toBe(false);
    expect(result.phase_2_started).toBe(false); expect(result.promotion).toBe("NOT_STARTED");
  });
  it("never offsets FP, acceptance miss or CI problems with later successes", async () => {
    for (const type of ["fp", "miss", "ci"]) {
      const fixtures = await five(), first = fixtures[0];
      const human = modified(first.human, h => {
        if (type === "fp") h.minor_eligibility_ground_truth = "NOT_MINOR";
        if (type === "miss") { h.focused_acceptance_misses = ["unplanned mobile impact"]; h.focused_acceptance_result.missed_items = h.focused_acceptance_misses; }
        if (type === "ci") h.normal_ci_comparison = "PROBLEM";
      });
      const record = finalize(first.envelope, human, first.checks, now);
      const records = [record, ...fixtures.slice(1).map(f => f.record)];
      const window = windowFor(records);
      expect(evaluateExit(records, window, { invalidation: proof }).status).toBe("SHADOW_EXIT_INCOMPLETE");
      expect(evaluateExit(records, withResolutions(window, [resolution(record)]), { invalidation: proof, resolutions: [resolution(record)] }).status).toBe("SHADOW_EXIT_CANDIDATE");
      expect(() => evaluateExit(records, window, { resolutions: [modified(resolution(record), r => { r.resolution_reference = ""; })] })).toThrow();
      expect(() => evaluateExit(records, window, { resolutions: [modified(resolution(record), r => { r.confirmed_by_role = "machine"; })] })).toThrow();
    }
  });
  it("deduplicates identical reruns and rejects conflicts or reused IDs", async () => {
    const f = await fixture();
    expect(evaluateExit([f.record, f.record], windowFor([f.record])).counts.qualifying_actual_changes).toBe(1);
    const other = finalize(f.envelope, modified(f.human, h => { h.human_notes = "different"; }), f.checks, now);
    const conflicting = modified(windowFor([f.record]), w => {
      w.pull_requests[0].durable_evidence.push(...publication(other));
      w.pull_requests[0].historical_finalized_record_digests.push(other.record_digest);
    });
    expect(() => evaluateExit([f.record, other], conflicting)).toThrow("DUPLICATE_OBSERVATION_ID");
    expect(() => validateObservation(modified(f.record, r => { r.observation_id = "another-id"; }))).toThrow();
  });
  it("keeps stale-head findings OPEN while counting only current-head evidence", async () => {
    const f = await fixture();
    const old = finalize(f.envelope, modified(f.human, h => { h.minor_eligibility_ground_truth = "NOT_MINOR"; }), f.checks, now);
    const envelope = observe(seal({ ...f.machine, head_sha: sha(900), tree_sha: sha(901) }), 200, now);
    const latest = finalize(envelope, seal({ ...f.human, ...pick(envelope, BINDING) }), seal({ ...f.checks, ...pick(envelope, IDENTITY), checks: f.checks.checks.map(c => ({ ...c, source_head_sha: envelope.head_sha })) }), now);
    const window = modified(windowFor([latest]), w => { w.pull_requests[0].historical_finalized_record_digests.push(old.record_digest); w.pull_requests[0].durable_evidence.push(...publication(old)); });
    const result = evaluateExit([old, latest], window);
    expect(result.counts.qualifying_actual_changes).toBe(1); expect(result.counts.stale_observations).toBe(1);
    expect(result.counts.unresolved_false_positive).toBe(1);
    expect(() => evaluateExit([latest], window)).toThrow("FINALIZED_HISTORY_OMITTED");
  });
  it("does not count machine artifacts, pre-window observations, #134, open or closed-unmerged PRs", async () => {
    const f = await fixture();
    expect(() => evaluateExit([f.envelope], windowFor([f.record]))).toThrow();
    const pending = modified(windowFor([f.record]), w => { w.pull_requests[0].finalized_record_digests = []; w.pull_requests[0].historical_finalized_record_digests = []; w.pull_requests[0].durable_evidence = []; });
    expect(evaluateExit([], pending).counts.qualifying_actual_changes).toBe(0);
    for (const mutate of [p => { p.state = "open"; }, p => { p.state = "closed"; }, p => { p.merged_at = "2026-10-01T00:00:00Z"; }]) {
      const w = modified(windowFor([f.record]), w => mutate(w.pull_requests[0]));
      expect(evaluateExit([f.record], w).counts.qualifying_actual_changes).toBe(0);
    }
    const approval = await fixture(134);
    expect(evaluateExit([approval.record], windowFor([approval.record])).counts.qualifying_actual_changes).toBe(0);
  });
  it("rejects stale invalidation and changed approved Authority", async () => {
    expect(() => validateInvalidation(modified(proof, p => { p.implementation_digest = "old"; }))).toThrow("STALE_INVALIDATION_EVIDENCE");
    expect(proof.cases).toHaveLength(8); expect(proof.cases.every(p => p.rejected)).toBe(true);
    const f = await fixture();
    expect(() => evaluateExit([f.record], modified(windowFor([f.record]), w => { w.authority.policy_digest = "wrong"; }))).toThrow("POLICY_DIGEST_MISMATCH");
  });
  it("rejects a successful stored CI result after a failing rerun", async () => {
    const f = await fixture();
    const window = modified(windowFor([f.record]), w => { w.pull_requests[0].normal_ci_conclusions["quality-gate"] = "failure"; });
    expect(() => evaluateExit([f.record], window)).toThrow("STALE_OR_CONTRADICTORY_NORMAL_CI");
  });
  it("cannot count multiple critical components as multiple actual examples", async () => {
    const f = await fixture();
    const envelope = observe(seal({ ...f.machine, critical_components: ["src/components/payment/card-save-confirmation.tsx", "src/components/auth/login-form.tsx"] }), 200, now);
    const record = finalize(envelope, seal({ ...f.human, ...pick(envelope, BINDING) }), f.checks, now);
    expect(evaluateExit([record], windowFor([record])).counts.critical_file_presentation_only).toBe(1);
  });
});

describe("whole-window audit and read-only reconstruction", () => {
  it.each(["missing", "artifact_only", "no_trigger", "failure"])("blocks %s shadow coverage outside finalized ledger", async kind => {
    const f = await fixture();
    const window = modified(windowFor([f.record]), w => {
      const row = w.pull_requests[0];
      row.finalized_record_digests = []; row.historical_finalized_record_digests = []; row.durable_evidence = [];
      if (kind === "missing") row.shadow_check_conclusion = "missing";
      if (kind === "artifact_only") { row.machine_record_digests = []; row.finalized_record_digests = []; row.measurement_evidence.observations = []; }
      if (kind === "no_trigger") { row.shadow_workflow_triggered = false; row.measurement_evidence = { run: null, observations: [] }; }
      if (kind === "failure") row.shadow_check_conclusion = "failure";
    });
    expect(evaluateExit([], window).conditions.shadow_skip).toBe(false);
  });
  it("requires complete universe; unknown categories block and mixed source cannot be excluded", async () => {
    const f = await fixture(); const window = windowFor([f.record]);
    expect(() => auditWindow(modified(window, w => { w.index_complete = false; }))).toThrow();
    expect(() => auditWindow(modified(window, w => { w.pull_requests.push(w.pull_requests[0]); }))).toThrow();
    expect(categoryFor(["docs/readme.md", "src/app/page.tsx"])).toBe("REAL_STOREFRONT");
    expect(categoryFor(["package.json", "pnpm-lock.yaml"])).toBe("SECURITY_OR_DEPENDENCY_ONLY");
    expect(categoryFor(["package.json", "pnpm-lock.yaml", "worklogs/new_ver_main.md"])).toBe("SECURITY_OR_DEPENDENCY_ONLY");
    expect(categoryFor(["scripts/readiness/shadow-observation.mjs"])).toBe("NON_ACTUAL_GATE_TOOLING");
    expect(categoryFor(["docs/readme.md"])).toBe("DOCS_ONLY"); expect(categoryFor(["src/test/a.test.ts"])).toBe("TEST_ONLY");
    expect(auditWindow(modified(window, w => { w.pull_requests[0].changed_files = ["unknown.file"]; })).indeterminate).toBe(1);
    const gate = modified(window, w => { w.pull_requests[0].changed_files = ["scripts/readiness/shadow-observation.mjs"]; });
    expect(evaluateExit([f.record], gate).counts.qualifying_actual_changes).toBe(0);
  });
  it("reconstructs a complete API snapshot and durable record; expired artifacts do not lose final evidence", async () => {
    const f = await fixture();
    const pr = { number: 200, state: "closed", base: { ref: "main", sha: f.record.base_sha }, head: { sha: f.record.head_sha }, changed_files: 1,
      created_at: now, updated_at: now, merged_at: now, closed_at: now, merge_commit_sha: sha(2200) };
    const prefix = `/repos/${REPOSITORY}`;
    const responses = {
      [`${prefix}/branches/main`]: { protected: true, commit: { sha: sha(999) } },
      [`${prefix}/commits/${MACHINE_POLICY_AUTHORITY_START}`]: { commit: { committer: { date: "2026-10-05T10:00:00Z" } } },
      [`${prefix}/compare/${MACHINE_POLICY_AUTHORITY_START}...${sha(999)}`]: { status: "ahead" },
      [`${prefix}/commits/${OPERATIONAL_SHADOW_MEASUREMENT_START}`]: { commit: { committer: { date: OPERATIONAL_SHADOW_MEASUREMENT_STARTED_AT } } },
      [`${prefix}/compare/${OPERATIONAL_SHADOW_MEASUREMENT_START}...${sha(999)}`]: { status: "ahead" },
      [`${prefix}/contents/scripts/readiness/minor-policy.v1.json?ref=${sha(999)}`]: { encoding: "base64", content: Buffer.from(JSON.stringify(defaultPolicy)).toString("base64") },
      [`${prefix}/contents/scripts/readiness/impact-map.v1.json?ref=${sha(999)}`]: { encoding: "base64", content: Buffer.from(JSON.stringify(defaultImpact)).toString("base64") },
      [`${prefix}/pulls?state=all&base=main&sort=created&direction=asc&per_page=100&page=1`]: [pr],
      [`${prefix}/pulls/200`]: pr,
      [`${prefix}/pulls/200/files?per_page=100&page=1`]: [{ filename: f.path }],
      [`${prefix}/git/commits/${pr.head.sha}`]: { tree: { sha: f.record.tree_sha } },
      [`${prefix}/issues/200/comments?per_page=100&page=1`]: [published(f.record)],
      [`${prefix}/pulls/200/reviews?per_page=100&page=1`]: [],
      [`${prefix}/actions/runs?event=pull_request&head_sha=${pr.head.sha}&per_page=100&page=1`]: { total_count: 2, workflow_runs: [
        { id: 1, event: "pull_request", path: ".github/workflows/readiness-shadow.yml", head_sha: pr.head.sha, pull_requests: [{ number: 200 }], created_at: now, updated_at: now, html_url: "https://example.test/run" },
        { id: 2, path: ".github/workflows/ci.yml", head_sha: pr.head.sha, pull_requests: [{ number: 200 }], updated_at: now },
      ] },
      [`${prefix}/actions/runs/1/jobs?per_page=100&page=1`]: { total_count: 1, jobs: [{ name: SHADOW_CHECK, conclusion: "success" }] },
      [`${prefix}/actions/runs/1/artifacts?per_page=100&page=1`]: { total_count: 1, artifacts: [{ name: SHADOW_CHECK, expired: true, id: 10 }] },
      [`${prefix}/actions/runs/2/jobs?per_page=100&page=1`]: { total_count: 5, jobs: CHECKS.map(name => ({ name, conclusion: "success" })) },
    };
    const get = async path => { expect(responses, path).toHaveProperty(path); return responses[path]; };
    const collected = await collectWindow(get, { capturedAt: now });
    expect(collected.observations).toEqual([f.record]); expect(auditWindow(collected.snapshot).shadow_skip).toBe(0);
    expect(collected.snapshot.schema_version).toBe(PUBLISHER_SNAPSHOT_VERSION);
    expect(collected.snapshot.measurement_started_at).toBe(OPERATIONAL_SHADOW_MEASUREMENT_STARTED_AT);
    for (const [start, error] of [[MACHINE_POLICY_AUTHORITY_START, "MACHINE_POLICY_AUTHORITY_START_NOT_ANCESTOR"], [OPERATIONAL_SHADOW_MEASUREMENT_START, "MEASUREMENT_START_NOT_ANCESTOR"]]) {
      const path = `${prefix}/compare/${start}...${sha(999)}`;
      responses[path].status = "behind";
      await expect(collectWindow(get, { capturedAt: now })).rejects.toThrow(error);
      responses[path].status = "ahead";
    }
    const artifactCollection = await collectWindow(get, { capturedAt: now,
      readArtifact: async () => ({ "shadow-observation-machine.json": f.envelope }) });
    expect(auditWindow(artifactCollection.snapshot).operational.shadow_skip).toBe(0);
    responses[`${prefix}/issues/200/comments?per_page=100&page=1`] = [];
    const rawOnly = await collectWindow(get, { capturedAt: now,
      readArtifact: async () => ({ "readiness-shadow.json": f.machine }) });
    expect(rawOnly.machines).toHaveLength(1);
    expect(auditWindow(rawOnly.snapshot).operational.shadow_skip).toBe(1);
    expect(evaluateExit([], rawOnly.snapshot).counts.qualifying_actual_changes).toBe(0);
    const oldEnvelope = observe(f.machine, f.record.pr_number, beforeStart);
    const oldRecord = finalize(oldEnvelope, f.human, f.checks, now);
    responses[`${prefix}/issues/200/comments?per_page=100&page=1`] = [published(oldRecord)];
    const shadowRun = responses[`${prefix}/actions/runs?event=pull_request&head_sha=${pr.head.sha}&per_page=100&page=1`].workflow_runs[0];
    shadowRun.created_at = beforeStart;
    for (const artifact of [null, { "shadow-observation-machine.json": oldEnvelope }]) {
      const oldCollection = await collectWindow(get, { capturedAt: now, readArtifact: async () => artifact });
      expect(evaluateExit(oldCollection.observations, oldCollection.snapshot).counts.qualifying_actual_changes).toBe(0);
      expect(auditWindow(oldCollection.snapshot).operational.shadow_skip).toBe(1);
    }
    shadowRun.created_at = now;
    responses[`${prefix}/issues/200/comments?per_page=100&page=1`] = [published(f.record)];
    expect(collected.snapshot.pull_requests[0].durable_evidence).toEqual(publication(f.record));
    // End-to-end API reconstruction must carry both kinds of durable evidence,
    // including a trusted review resolution, through the sealed offline snapshot.
    const fp = finalize(f.envelope, modified(f.human, h => { h.minor_eligibility_ground_truth = "NOT_MINOR"; }), f.checks, now);
    const r = resolution(fp);
    responses[`${prefix}/issues/200/comments?per_page=100&page=1`] = [published(fp), { id: 99, user: { login: "attacker" }, body: "<!-- shadow-observation:v1 --> broken" }];
    responses[`${prefix}/pulls/200/reviews?per_page=100&page=1`] = [published(r, "resolution", "myong-ideal", 200, 456, "pull_request_review")];
    const reconstructed = await collectWindow(get, { capturedAt: now });
    expect(reconstructed.resolutions).toEqual([r]);
    expect(reconstructed.snapshot.pull_requests[0].ignored_durable_evidence).toHaveLength(1);
    expect(reconstructed.snapshot.pull_requests[0].durable_evidence[1].publisher_evidence_type).toBe("pull_request_review");
    const replay = evaluateExit(reconstructed.observations, JSON.parse(JSON.stringify(reconstructed.snapshot)), { resolutions: reconstructed.resolutions });
    expect(replay.counts.unresolved_false_positive).toBe(0);
    expect(await collectWindow(get, { capturedAt: now })).toEqual(reconstructed);
    // Actual GitHub merged-run responses can have an empty association list.
    pr.head.repo = { full_name: REPOSITORY }; pr.head.ref = "fixture-branch";
    const runs = responses[`${prefix}/actions/runs?event=pull_request&head_sha=${pr.head.sha}&per_page=100&page=1`].workflow_runs;
    for (const run of runs) { run.pull_requests = []; run.event = "pull_request"; run.head_repository = { full_name: REPOSITORY }; run.head_branch = pr.head.ref; }
    expect(auditWindow((await collectWindow(get, { capturedAt: now })).snapshot).shadow_skip).toBe(0);
    runs[0].head_branch = "wrong-branch";
    expect(auditWindow((await collectWindow(get, { capturedAt: now })).snapshot).shadow_skip).toBe(1);
    runs[0].head_branch = pr.head.ref;
    responses[`${prefix}/pulls/200`].changed_files = 2;
    await expect(collectWindow(get, { capturedAt: now })).rejects.toThrow("GITHUB_DIFF_INCOMPLETE");
  });
});

describe("Human evidence publisher adversarial boundary", () => {
  async function withFinding() {
    const f = await fixture();
    return finalize(f.envelope, modified(f.human, h => { h.minor_eligibility_ground_truth = "NOT_MINOR"; }), f.checks, now);
  }
  it.each(["issue_comment", "pull_request_review"])("1. accepts an exact trusted publisher %s and retains provenance", async type => {
    const { record } = await fixture();
    const comment = published(record, "observation", "myong-ideal", record.pr_number, 123, type);
    const result = recordsFromComments([comment], record.pr_number, "observation", type);
    expect(result.records).toEqual([record]);
    expect(result.provenance[0]).toMatchObject({ publisher_login: "myong-ideal", publisher_evidence_id: 123,
      publisher_evidence_reference: comment.html_url, record_digest: record.record_digest, pr_number: record.pr_number });
    expect(evaluateExit(result.records, windowFor([record])).counts.qualifying_actual_changes).toBe(1);
    expect(TRUSTED_SHADOW_EVIDENCE_PUBLISHERS).toEqual(["myong-ideal"]);
    expect(Object.isFrozen(TRUSTED_SHADOW_EVIDENCE_PUBLISHERS)).toBe(true);
  });
  it.each(["third-party", "machine[bot]", "Myong-Ideal", ""])("2. identical sealed observation from %s has no Authority or credit", async login => {
    const { record } = await fixture();
    const result = recordsFromComments([published(record, "observation", login)], record.pr_number);
    expect(result.records).toEqual([]); expect(result.provenance).toEqual([]);
    expect(result.ignored[0].reason).toBe("UNTRUSTED_HUMAN_EVIDENCE_PUBLISHER");
    const w = modified(windowFor([record]), w => {
      const row = w.pull_requests[0]; row.finalized_record_digests = []; row.historical_finalized_record_digests = []; row.durable_evidence = [];
    });
    expect(evaluateExit(result.records, w).counts.qualifying_actual_changes).toBe(0);
    expect(() => evaluateExit([record], w)).toThrow("TRUSTED_DURABLE_PUBLISHER_PROVENANCE_REQUIRED");
  });
  it.each(["observation", "resolution"])("3. untrusted malformed %s marker cannot poison trusted collection", async kind => {
    const record = kind === "observation" ? (await fixture()).record : resolution(await withFinding());
    const trusted = published(record, kind);
    const malicious = { ...published(record, kind, "attacker"), body: `<!-- shadow-${kind}:v1 -->\n\`\`\`json\n{broken` };
    const result = recordsFromComments([malicious, trusted], record.pr_number, kind);
    expect(result.records).toEqual([record]); expect(result.ignored).toHaveLength(1);
  });
  it.each(["observation", "resolution"])("4. trusted malformed %s fails closed, including a second broken marker", async kind => {
    const record = kind === "observation" ? (await fixture()).record : resolution(await withFinding());
    const trusted = published(record, kind);
    for (const body of [`<!-- shadow-${kind}:v1 -->\n\`\`\`json\n{broken\n\`\`\``, `${trusted.body}\n<!-- shadow-${kind}:v1 --> incomplete`]) {
      expect(() => recordsFromComments([{ ...trusted, body }], record.pr_number, kind)).toThrow();
    }
  });
  it("5. Machine-created local Human-role resolution cannot resolve a finding", async () => {
    const record = await withFinding(), local = resolution(record), w = windowFor([record]);
    expect(local.confirmed_by_role).toBe("human_operator");
    expect(() => evaluateExit([record], w, { resolutions: [local] })).toThrow("TRUSTED_DURABLE_PUBLISHER_PROVENANCE_REQUIRED");
    expect(evaluateExit([record], w).counts.unresolved_false_positive).toBe(1);
    const untrusted = recordsFromComments([published(local, "resolution", "machine[bot]")], record.pr_number, "resolution");
    expect(untrusted.records).toEqual([]);
  });
  it("6. trusted durable resolution resolves only its exact bound finding", async () => {
    const record = await withFinding(), publishedResolution = resolution(record);
    const w = withResolutions(windowFor([record]), [publishedResolution]);
    const result = evaluateExit([record], w, { resolutions: [publishedResolution] });
    expect(result.counts.unresolved_false_positive).toBe(0);
    expect(result.findings[0].status).toBe("RESOLVED");
    expect(result.findings[0].resolution_publisher_evidence_reference).toBe(published(publishedResolution, "resolution").html_url);
    expect(() => evaluateExit([record], w)).toThrow("DURABLE_RESOLUTION_OMITTED");
  });
  it.each(["pr_number", "head_sha", "observation_digest", "finding_id", "record_digest"])("7. rejects trusted resolution with wrong %s", async key => {
    const record = await withFinding(), correct = resolution(record);
    const wrong = modified(correct, r => { r[key] = key === "pr_number" ? 201 : key === "head_sha" ? sha(998) : key === "finding_id" ? "wrong-finding" : `sha256:${"a".repeat(64)}`; });
    if (key === "pr_number") {
      expect(() => recordsFromComments([published(wrong, "resolution", "myong-ideal", 200)], 200, "resolution")).toThrow("COMMENT_PR_MISMATCH");
    } else if (key === "record_digest") {
      const changed = modified(correct, r => { r.resolution_reference = "https://example.test/another-resolution"; });
      expect(() => evaluateExit([record], withResolutions(windowFor([record]), [correct]), { resolutions: [changed] })).toThrow();
    } else {
      const w = withResolutions(windowFor([record]), [wrong]);
      expect(() => evaluateExit([record], w, { resolutions: [wrong] })).toThrow();
    }
  });
  it("8. a trusted observation copied to another PR is rejected", async () => {
    const { record } = await fixture();
    expect(() => recordsFromComments([published(record, "observation", "myong-ideal", 201)], 201)).toThrow("COMMENT_PR_MISMATCH");
  });
  it("9. role, caller-claimed publisher or legacy snapshot cannot replace collector provenance", async () => {
    const { record } = await fixture();
    const w = modified(windowFor([record]), w => { delete w.pull_requests[0].durable_evidence; w.publisher_login = "myong-ideal"; });
    expect(() => evaluateExit([record], w)).toThrow("TRUSTED_DURABLE_PUBLISHER_PROVENANCE_REQUIRED");
    expect(() => evaluateExit([record], modified(windowFor([record]), w => { w.schema_version = "1.0"; }))).toThrow("WINDOW_AUTHORITY_INVALID");
    const untrusted = modified(windowFor([record]), w => { w.pull_requests[0].durable_evidence[0].publisher_login = "attacker"; });
    expect(() => evaluateExit([record], untrusted)).toThrow("UNTRUSTED_HUMAN_EVIDENCE_PUBLISHER");
  });
  it("10. trusted offline replay is deterministic and identical records/resolutions are idempotent", async () => {
    const record = await withFinding(), r = resolution(record), w = withResolutions(windowFor([record]), [r]);
    const once = evaluateExit([record], w, { resolutions: [r], invalidation: proof });
    expect(evaluateExit([record, record], JSON.parse(JSON.stringify(w)), { resolutions: [r, r], invalidation: proof })).toEqual(once);
  });
  it.each(["publisher_evidence_id", "publisher_evidence_reference", "pr_number", "record_digest", "evidence_kind"])("rejects re-sealed snapshot provenance with altered %s", async key => {
    const { record } = await fixture();
    const w = modified(windowFor([record]), w => { w.pull_requests[0].durable_evidence[0][key] = key === "publisher_evidence_id" || key === "pr_number" ? 999 : key === "evidence_kind" ? "resolution" : "wrong"; });
    expect(() => evaluateExit([record], w)).toThrow();
  });
});

describe("offline CLI and immutable outputs", () => {
  it("runs finalizer/evaluator outside a Git worktree and emits JSON HOLD on bad evidence", async () => {
    const f = await fixture(); const dir = mkdtempSync(join(tmpdir(), "shadow-cli-"));
    for (const [name, value] of Object.entries({ machine: f.envelope, human: f.human, checks: f.checks, window: windowFor([f.record]), observations: [f.record] })) writeFileSync(join(dir, `${name}.json`), JSON.stringify(value));
    execFileSync(process.execPath, [join(process.cwd(), "scripts/readiness/shadow-observation.mjs"), "finalize", "--machine", join(dir, "machine.json"), "--human", join(dir, "human.json"), "--checks", join(dir, "checks.json"), "--output", join(dir, "final.json")], { cwd: dir });
    expect(JSON.parse(readFileSync(join(dir, "final.json"))).status).toBe("FINALIZED");
    writeFileSync(join(dir, "bad.json"), JSON.stringify([modified(f.record, r => { r.false_positive = true; })]));
    const run = spawnSync(process.execPath, [join(process.cwd(), "scripts/readiness/shadow-exit-evaluator.mjs"), "--observations", join(dir, "bad.json"), "--window", join(dir, "window.json"), "--output", join(dir, "exit.json")], { cwd: dir });
    expect(run.status).toBe(1); expect(JSON.parse(readFileSync(join(dir, "exit.json"))).status).toBe("HOLD_EVIDENCE_INVALID");
    expect(canonical(AUTHORITY)).toContain("1.1.2-operational-approved");
  // Two cold Node processes load the classifier dependencies. Allow startup
  // time on shared runners without changing any fail-closed assertions.
  }, 30_000);
});

// Synthetic identities and times only; these are never operational evidence.
describe("separate operational measurement boundary", () => {
  function withoutMeasurement(window) {
    return modified(window, w => {
      for (const key of ["measurement_start_authority", "measurement_started_at", "measurement_start_is_ancestor", "historical_rows"]) delete w[key];
    });
  }
  function gapCheckpoint(record, capturedAt = beforeStart) {
    return modified(withoutMeasurement(windowFor([record])), w => {
      w.captured_at = capturedAt;
      const row = w.pull_requests[0];
      row.created_at = "2026-10-05T12:00:00Z"; row.updated_at = capturedAt; row.state = "open"; row.merged_at = null; row.closed_at = null;
      row.shadow_workflow_triggered = false; row.shadow_check_conclusion = "missing"; row.observation_artifact_exists = false;
      row.machine_record_digests = []; row.finalized_record_digests = []; row.historical_finalized_record_digests = [];
      row.durable_evidence = []; row.measurement_evidence = { run: null, observations: [] };
    });
  }
  function withHistory(window, checkpoints) {
    return modified(window, w => { w.historical_rows = collectHistoricalRows(checkpoints, w.captured_at); });
  }
  function preExisting(window) {
    return modified(window, w => { w.pull_requests[0].created_at = "2026-10-05T12:00:00Z"; });
  }
  it("pins separate starts without extending Machine Policy Authority bindings", () => {
    expect(MACHINE_POLICY_AUTHORITY_START).toBe("eead719007d3483ceb4e270a431f6c591430c2fc");
    expect(OPERATIONAL_SHADOW_MEASUREMENT_START).toBe("d077fb4710597ac96eb3967a3415a4f067a52f12");
    expect(MACHINE_POLICY_AUTHORITY_START).not.toBe(OPERATIONAL_SHADOW_MEASUREMENT_START);
    expect(OPERATIONAL_SHADOW_MEASUREMENT_STARTED_AT).toBe("2026-10-07T05:07:18Z");
    expect(Object.keys(AUTHORITY)).toEqual(["policy_version", "policy_digest", "impact_map_version", "impact_map_digest"]);
  });
  it.each(["start_is_ancestor", "measurement_start_is_ancestor"])("rejects false %s", async key => {
    const f = await fixture();
    expect(() => auditWindow(modified(windowFor([f.record]), w => { w[key] = false; }))).toThrow(/BASELINE_INVALID/);
  });
  it("replays legacy history but cannot evaluate Operational Exit without measurement fields", async () => {
    const f = await fixture(), legacy = withoutMeasurement(windowFor([f.record]));
    expect(auditWindow(legacy).measurement_evidence_status).toBe("MEASUREMENT_EVIDENCE_MISSING");
    expect(() => evaluateExit([f.record], legacy)).toThrow("MEASUREMENT_EVIDENCE_MISSING");
    expect(() => auditWindow(modified(windowFor([f.record]), w => { w.measurement_started_at = now; }))).toThrow("MEASUREMENT_DATES_INVALID");
  });
  it.each([137, 139, 146])("retains pre-ledger gap/indeterminate #%s without new Operational skips", async number => {
    const f = await fixture(number);
    const checkpoint = modified(gapCheckpoint(f.record), w => { if (number === 146) w.pull_requests[0].changed_files = ["unknown.file"]; });
    const window = withHistory(modified(windowFor([f.record]), w => { w.pull_requests = structuredClone(checkpoint.pull_requests); }), [checkpoint]);
    const audit = auditWindow(window), result = evaluateExit([], window);
    expect(audit.historical_rows).toHaveLength(1);
    expect(audit.historical_rows[0].audit.skipped).toBe(true);
    expect(audit.historical_rows[0].audit.indeterminate).toBe(number === 146);
    expect(audit.rows[0].measurement_status).toBe("MEASUREMENT_BOUNDARY_UNKNOWN");
    expect(audit.rows[0].in_measurement_window).toBe(false);
    expect(result.conditions.measurement_boundary).toBe(false);
    expect(result.counts.shadow_skip).toBe(0); expect(result.counts.indeterminate).toBe(0);
    expect(result.counts.qualifying_actual_changes).toBe(0);
    expect(audit.rows[0].shadow_check_conclusion).toBe("missing");
    expect(audit.rows[0].category).toBe(number === 146 ? "INDETERMINATE" : "REAL_STOREFRONT");
  });
  it("permits fresh same-old-head coverage and independent conditions, never actual/class/critical/reuse credit", async () => {
    const f = await fixture(200, "dynamic"), checkpoint = gapCheckpoint(f.record);
    const w = withHistory(preExisting(windowFor([f.record])), [checkpoint]);
    const result = evaluateExit([f.record], w);
    expect(result.window.rows[0].measurement_status).toBe("MEASUREMENT_BOUNDARY_UNKNOWN");
    expect(result.window.rows[0].in_measurement_window).toBe(true);
    expect(result.conditions.measurement_boundary).toBe(false);
    expect(result.counts.shadow_skip).toBe(0); expect(result.counts.not_finalized).toBe(0);
    expect(result.conditions.fail_closed).toBe(true);
    expect(result.counts.qualifying_actual_changes).toBe(0); expect(result.counts.distinct_change_classes).toBe(0);
    expect(result.counts.critical_file_presentation_only).toBe(0); expect(result.conditions.authority_reuse).toBe(false);
  });
  it("retains a caller-sealed post-start different-head checkpoint without granting source timing or credit", async () => {
    const f = await fixture(), prior = modified(gapCheckpoint(f.record, afterStart), w => {
      w.pull_requests[0].head_sha = sha(800); w.pull_requests[0].tree_sha = sha(801);
    });
    const w = withHistory(preExisting(windowFor([f.record])), [prior]);
    const observed = evaluateExit([f.record], w);
    expect(observed.counts.qualifying_actual_changes).toBe(0);
    expect(observed.counts.distinct_change_classes).toBe(0);
    expect(observed.counts.critical_file_presentation_only).toBe(0);
    expect(observed.conditions.authority_reuse).toBe(false);
    expect(observed.conditions.measurement_boundary).toBe(false);
    expect(observed.window.rows[0].actual_credit_allowed).toBe(false);
    expect(observed.status).toBe("SHADOW_EXIT_INCOMPLETE");
    const missing = modified(w, w => {
      const row = w.pull_requests[0]; row.state = "open";
      row.shadow_workflow_triggered = false; row.shadow_check_conclusion = "missing";
      row.machine_record_digests = []; row.finalized_record_digests = []; row.historical_finalized_record_digests = []; row.durable_evidence = [];
      row.measurement_evidence = { run: null, observations: [] };
    });
    const result = evaluateExit([], missing);
    // An unauthenticated checkpoint cannot create an Operational subject either.
    expect(result.counts.shadow_skip).toBe(0); expect(result.counts.measurement_boundary_unknown).toBe(1);
    expect(result.window.rows[0].in_measurement_window).toBe(false);
    expect(result.window.historical_rows[0].audit.skipped).toBe(true);
  });
  it.each(["same-old-head", "different-pre-start-head", "different-post-start-head"])("caller-created %s context cannot change Operational eligibility", async kind => {
    const f = await fixture(200, "dynamic"), w = preExisting(windowFor([f.record]));
    const checkpoint = modified(gapCheckpoint(f.record, kind === "different-post-start-head" ? afterStart : beforeStart), prior => {
      if (kind !== "same-old-head") { prior.pull_requests[0].head_sha = sha(800); prior.pull_requests[0].tree_sha = sha(801); }
      prior.pull_requests[0].changed_files = ["unknown.file"];
    });
    const baseline = evaluateExit([f.record], w);
    const result = evaluateExit([f.record], withHistory(w, [checkpoint]));
    expect(result.counts).toEqual(baseline.counts);
    expect(result.conditions).toEqual(baseline.conditions);
    expect(result.window.rows).toEqual(baseline.window.rows);
    expect(result.window.historical_rows).toHaveLength(1);
    expect(result.window.historical_rows[0].row).toEqual(checkpoint.pull_requests[0]);
    expect(result.window.historical_rows[0].audit.skipped).toBe(true);
    expect(result.window.historical_rows[0].audit.indeterminate).toBe(true);
    expect(result.counts.measurement_boundary_unknown).toBe(1);
    expect(result.counts.qualifying_actual_changes).toBe(0);
    expect(result.status).toBe("SHADOW_EXIT_INCOMPLETE");
  });
  it("fresh same-old-head coverage needs workflow and original machine timing independently of checkpoints", async () => {
    const f = await fixture(), w = withHistory(preExisting(windowFor([f.record])), [gapCheckpoint(f.record)]);
    const result = evaluateExit([f.record], w);
    expect(result.counts.shadow_skip).toBe(0);
    expect(result.counts.qualifying_actual_changes).toBe(0);
    expect(result.conditions.measurement_boundary).toBe(false);
    const noObservation = modified(w, w => { w.pull_requests[0].measurement_evidence.observations = []; });
    expect(evaluateExit([f.record], noObservation).counts.shadow_skip).toBe(1);
    const noRun = modified(w, w => { w.pull_requests[0].measurement_evidence.run = null; });
    expect(() => evaluateExit([f.record], noRun)).toThrow("MEASUREMENT_RUN_MISSING");
  });
  it("post-start new PR qualifies without any checkpoint evidence", async () => {
    const f = await fixture(), w = windowFor([f.record]);
    expect(w.historical_rows).toEqual([]);
    const result = evaluateExit([f.record], w);
    expect(result.window.rows[0].measurement_status).toBe("OPERATIONAL");
    expect(result.window.rows[0].actual_credit_allowed).toBe(true);
    expect(result.counts.qualifying_actual_changes).toBe(1);
    expect(result.counts.measurement_boundary_unknown).toBe(0);
  });
  it("unknown timing stays UNKNOWN despite merge, updated_at, discovery or a fresh run", async () => {
    const f = await fixture(), w = preExisting(windowFor([f.record]));
    const result = evaluateExit([f.record], w);
    expect(result.counts.measurement_boundary_unknown).toBe(1);
    expect(result.window.rows[0].measurement_status).toBe("MEASUREMENT_BOUNDARY_UNKNOWN");
    expect(result.counts.qualifying_actual_changes).toBe(0);
    expect(result.status).toBe("SHADOW_EXIT_INCOMPLETE");
    const before = modified(gapCheckpoint(f.record), w => { w.pull_requests[0].head_sha = sha(800); w.pull_requests[0].tree_sha = sha(801); });
    expect(evaluateExit([f.record], withHistory(w, [before])).counts.measurement_boundary_unknown).toBe(1);
  });
  it("new post-start PR needs coverage before any observation exists", async () => {
    const f = await fixture();
    const w = modified(windowFor([f.record]), w => {
      const row = w.pull_requests[0]; row.state = "open"; row.shadow_workflow_triggered = false;
      row.machine_record_digests = []; row.finalized_record_digests = []; row.historical_finalized_record_digests = []; row.durable_evidence = [];
      row.measurement_evidence = { run: null, observations: [] };
    });
    expect(evaluateExit([], w).counts.shadow_skip).toBe(1);
    const closed = modified(w, w => { w.pull_requests[0].state = "closed"; });
    expect(evaluateExit([], closed).counts.shadow_skip).toBe(0);
    expect(evaluateExit([], closed).counts.qualifying_actual_changes).toBe(0);
  });
  it.each(["scripts/readiness/shadow-common.mjs", "package.json", "docs/notes.md", "src/test/example.test.ts"])("requires coverage but gives no actual credit for %s", async path => {
    const f = await fixture(), w = windowFor([f.record], { [f.record.pr_number]: [path] });
    expect(evaluateExit([f.record], w).counts.qualifying_actual_changes).toBe(0);
    const missing = modified(w, w => { w.pull_requests[0].measurement_evidence.observations = []; });
    expect(evaluateExit([f.record], missing).counts.shadow_skip).toBe(1);
  });
  it.each(["head_sha", "tree_sha", "base_sha"])("stale %s cannot earn Operational credit", async key => {
    const f = await fixture();
    const w = modified(windowFor([f.record]), w => {
      const row = w.pull_requests[0]; row[key] = sha(777);
      row.finalized_record_digests = []; row.machine_record_digests = [];
      row.shadow_workflow_triggered = false; row.measurement_evidence = { run: null, observations: [] };
    });
    const result = evaluateExit([f.record], w);
    expect(result.counts.qualifying_actual_changes).toBe(0); expect(result.counts.stale_observations).toBe(1);
  });
  it("late finalization and publication never turn an old machine into a new measurement", async () => {
    const f = await fixture(200, "dynamic"), envelope = observe(f.machine, 200, beforeStart);
    const record = finalize(envelope, f.human, f.checks, now);
    const result = evaluateExit([record], windowFor([record]));
    expect(result.counts.qualifying_actual_changes).toBe(0);
    expect(result.counts.not_finalized).toBe(1); expect(result.conditions.fail_closed).toBe(false);
    expect(result.counts.shadow_skip).toBe(1);
  });
  it("historical OPEN findings block even when all five Operational samples qualify", async () => {
    const f = await fixture(199), envelope = observe(f.machine, 199, beforeStart);
    const old = finalize(envelope, modified(f.human, h => { h.minor_eligibility_ground_truth = "NOT_MINOR"; }), f.checks, beforeStart);
    const actual = await Promise.all([fixture(200), fixture(201, "css"), fixture(202, "style"), fixture(203), fixture(204, "dynamic")]);
    const records = [old, ...actual.map(f => f.record)];
    const w = modified(windowFor(records), w => { w.pull_requests[0].merged_at = beforeStart; });
    const result = evaluateExit(records, w, { invalidation: proof });
    expect(result.counts.qualifying_actual_changes).toBe(5);
    expect(result.counts.unresolved_false_positive).toBe(1); expect(result.status).toBe("SHADOW_EXIT_INCOMPLETE");
    expect(() => evaluateExit(records.slice(1), w)).toThrow("FINALIZED_HISTORY_OMITTED");
  });
  it("old-head successes cannot satisfy the five/three/critical conditions", async () => {
    const fixtures = await Promise.all([fixture(200), fixture(201, "css"), fixture(202, "style"), fixture(203), fixture(204, "dynamic")]);
    const records = fixtures.map(f => f.record);
    const w = withHistory(modified(windowFor(records), w => { for (const row of w.pull_requests) row.created_at = beforeStart; }), records.map(r => gapCheckpoint(r)));
    const result = evaluateExit(records, w, { invalidation: proof });
    expect(result.counts.shadow_skip).toBe(0); expect(result.counts.qualifying_actual_changes).toBe(0);
    expect(result.conditions.actual_changes).toBe(false); expect(result.conditions.change_classes).toBe(false); expect(result.conditions.critical_presentation).toBe(false);
    expect(result.blocking_authority).toBe(false); expect(result.fast_lane_production_enabled).toBe(false);
    expect(result.phase_2_started).toBe(false); expect(result.promotion).toBe("NOT_STARTED");
    expect(result).not.toHaveProperty("human_go"); expect(result).not.toHaveProperty("production_human_go");
  });
  it("validates prior snapshots, preserves history on reload and rejects omitted historical findings", async () => {
    const f = await fixture(), prior = gapCheckpoint(f.record);
    expect(collectHistoricalRows([prior, prior], now)).toEqual(collectHistoricalRows([prior], now));
    const current = withHistory(preExisting(windowFor([f.record])), [prior]);
    expect(evaluateExit([f.record, f.record], current)).toEqual(evaluateExit([f.record], JSON.parse(JSON.stringify(current))));
    for (const mutate of [w => { w.record_digest = "bad"; }, w => { w.repository = "wrong/repo"; }, w => { w.authority.policy_digest = "bad"; }, w => { w.pull_requests[0].head_sha = "bad"; }]) {
      const bad = structuredClone(prior); mutate(bad);
      // Verify shape/Authority/identity independently of the outer integrity seal.
      expect(() => collectHistoricalRows([bad.record_digest === "bad" ? bad : seal(bad)], now)).toThrow();
    }
    const withFinding = windowFor([f.record]);
    const omitted = modified(withHistory(windowFor([f.record]), [withFinding]), w => {
      w.pull_requests[0].historical_finalized_record_digests = []; w.pull_requests[0].finalized_record_digests = []; w.pull_requests[0].durable_evidence = [];
    });
    expect(() => auditWindow(omitted)).toThrow("HISTORICAL_EVIDENCE_OMITTED");
  });
  it("collector transport is GET-only; SHADOW workflow has no production handoff", () => {
    const source = readFileSync(new URL("./shadow-github-adapter.mjs", import.meta.url), "utf8");
    expect(source).toContain('["api", "--method", "GET", path]');
    expect(source).not.toMatch(/"(?:POST|PUT|PATCH|DELETE)"/);
    const workflow = readFileSync(new URL("../../.github/workflows/readiness-shadow.yml", import.meta.url), "utf8");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toMatch(/contents: write|deploy|kubectl|docker|human.go/i);
  });
});

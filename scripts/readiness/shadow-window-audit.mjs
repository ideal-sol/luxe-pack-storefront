import { AUTHORITY, CHECKS, IDENTITY, REPOSITORY, WINDOW_START, SHADOW_CHECK, authority, bind, cli, enumeration, identity, object, options, pick, readJson, requireValue, seal, sha, string, strings, timestamp, verifySeal, writeJson } from "./shadow-common.mjs";
import { PUBLISHER_SNAPSHOT_VERSION, validatePublisherProvenance } from "./shadow-publisher.mjs";

// Exclusions affect actual-change counting, not observation coverage. Mixed
// source/tooling changes remain real changes; unknown paths are never excluded.
export function categoryFor(files) {
  strings(files, "CHANGED_FILES");
  if (!files.length) return "INDETERMINATE";
  if (files.some(path => /^(src\/(?!test\/)|public\/)/.test(path))) return "REAL_STOREFRONT";
  const substantive = files.filter(path => !/^(docs\/|worklogs\/.*\.md$|[^/]+\.md$)/.test(path));
  if (!substantive.length) return "DOCS_ONLY";
  if (substantive.every(path => /^(src\/test\/|tests\/)/.test(path))) return "TEST_ONLY";
  if (substantive.every(path => /^(package\.json|pnpm-lock\.yaml|scripts\/ci\/security-audit-policy\.mjs)$/.test(path))) return "SECURITY_OR_DEPENDENCY_ONLY";
  if (substantive.every(path => /^(scripts\/|\.github\/|src\/test\/readiness)/.test(path))) return "NON_ACTUAL_GATE_TOOLING";
  return "INDETERMINATE";
}

export function currentIdentity(record, row) {
  return IDENTITY.every(key => record[key] === row[key]);
}

export function auditWindow(snapshot) {
  verifySeal(snapshot, "WINDOW_SNAPSHOT");
  requireValue(snapshot.schema_version === PUBLISHER_SNAPSHOT_VERSION && snapshot.repository === REPOSITORY && snapshot.start_authority === WINDOW_START, "WINDOW_AUTHORITY_INVALID");
  authority(snapshot.authority);
  requireValue(snapshot.index_complete === true && snapshot.pagination_complete === true && string(snapshot.evidence_reference), "WINDOW_INDEX_INCOMPLETE");
  requireValue(sha(snapshot.protected_main_sha) && snapshot.protected_main === true && snapshot.start_is_ancestor === true, "WINDOW_BASELINE_INVALID");
  timestamp(snapshot.started_at); timestamp(snapshot.captured_at);
  requireValue(Date.parse(snapshot.started_at) <= Date.parse(snapshot.captured_at), "WINDOW_DATES_INVALID");
  requireValue(Array.isArray(snapshot.pull_requests), "WINDOW_INDEX_MALFORMED");
  const numbers = new Set();
  const rows = snapshot.pull_requests.map(pr => {
    identity(pr);
    requireValue(!numbers.has(pr.pr_number), "WINDOW_DUPLICATE_PR"); numbers.add(pr.pr_number);
    enumeration(pr.state, ["open", "closed", "merged"], "PR_STATE");
    timestamp(pr.created_at); timestamp(pr.updated_at);
    requireValue(pr.base_ref === "main" && pr.files_complete === true, "PR_SCOPE_INCOMPLETE");
    if (pr.state === "merged") { timestamp(pr.merged_at); requireValue(sha(pr.merge_commit_sha), "MERGE_IDENTITY_MISSING"); }
    if (pr.state === "closed") timestamp(pr.closed_at);
    const endAt = pr.state === "merged" ? pr.merged_at : pr.state === "closed" ? pr.closed_at : snapshot.captured_at;
    const inWindow = pr.pr_number !== 134 && pr.merge_commit_sha !== WINDOW_START && Date.parse(endAt) > Date.parse(snapshot.started_at);
    const category = categoryFor(pr.changed_files);
    const excluded = !inWindow ? "BEFORE_WINDOW" : pr.state === "closed" ? "CLOSED_UNMERGED" : category === "REAL_STOREFRONT" || category === "INDETERMINATE" ? null : category;
    const expected = inWindow && pr.state !== "closed";
    requireValue(typeof pr.shadow_workflow_triggered === "boolean" && typeof pr.observation_artifact_exists === "boolean", "SHADOW_EVIDENCE_INVALID");
    enumeration(pr.shadow_check_conclusion, ["missing", "pending", "success", "failure", "cancelled", "timed_out", "skipped", "neutral", "action_required"], "SHADOW_CHECK");
    if (pr.shadow_workflow_triggered) requireValue(string(pr.shadow_evidence_reference) && pr.shadow_source_head_sha === pr.head_sha, "SHADOW_HEAD_MISMATCH");
    strings(pr.machine_record_digests, "MACHINE_RECORD_DIGESTS");
    strings(pr.finalized_record_digests, "FINALIZED_RECORD_DIGESTS");
    strings(pr.historical_finalized_record_digests, "HISTORICAL_RECORD_DIGESTS");
    strings(pr.resolution_record_digests, "RESOLUTION_RECORD_DIGESTS");
    requireValue(Array.isArray(pr.durable_evidence), "TRUSTED_DURABLE_PUBLISHER_PROVENANCE_REQUIRED");
    for (const provenance of pr.durable_evidence) validatePublisherProvenance(provenance, pr.pr_number);
    for (const [kind, digests] of [["observation", pr.historical_finalized_record_digests], ["resolution", pr.resolution_record_digests]]) {
      const published = pr.durable_evidence.filter(entry => entry.evidence_kind === kind);
      requireValue(digests.every(digest => published.some(entry => entry.record_digest === digest)), "TRUSTED_DURABLE_PUBLISHER_PROVENANCE_REQUIRED");
      requireValue(published.every(entry => digests.includes(entry.record_digest)), "PUBLISHER_EVIDENCE_INDEX_MISMATCH");
    }
    requireValue(pr.finalized_record_digests.every(digest => pr.historical_finalized_record_digests.includes(digest)), "WINDOW_FINALIZATION_HISTORY_MISSING");
    requireValue([...pr.machine_record_digests, ...pr.historical_finalized_record_digests].every(digest => /^sha256:[0-9a-f]{64}$/.test(digest)), "WINDOW_DIGEST_INVALID");
    object(pr.normal_ci_conclusions, "WINDOW_CI");
    requireValue(Object.keys(pr.normal_ci_conclusions).every(name => CHECKS.includes(name)), "WINDOW_CI_NAME_INVALID");
    for (const conclusion of Object.values(pr.normal_ci_conclusions)) enumeration(conclusion, ["pending", "success", "failure", "cancelled", "timed_out", "skipped", "neutral", "action_required"], "WINDOW_CI_CONCLUSION");
    const actualObservation = pr.machine_record_digests.length > 0 || pr.finalized_record_digests.length > 0;
    const skipped = expected && (!pr.shadow_workflow_triggered || pr.shadow_check_conclusion !== "success" || !actualObservation);
    return { ...pick(pr, IDENTITY), state: pr.state, category, exclusion_reason: excluded, in_window: inWindow,
      expected_shadow_workflow: expected, shadow_workflow_triggered: pr.shadow_workflow_triggered,
      shadow_check_name: SHADOW_CHECK, shadow_check_conclusion: pr.shadow_check_conclusion,
      observation_artifact_exists: pr.observation_artifact_exists, actual_shadow_observation: actualObservation,
      finalized_observation_exists: pr.finalized_record_digests.length > 0,
      machine_record_digests: pr.machine_record_digests, finalized_record_digests: pr.finalized_record_digests,
      historical_finalized_record_digests: pr.historical_finalized_record_digests,
      durable_evidence: pr.durable_evidence, resolution_record_digests: pr.resolution_record_digests,
      normal_ci_conclusions: pr.normal_ci_conclusions,
      skipped, indeterminate: inWindow && pr.state !== "closed" && category === "INDETERMINATE" };
  });
  return seal({ schema_version: PUBLISHER_SNAPSHOT_VERSION, repository: REPOSITORY, authority: AUTHORITY, start_authority: WINDOW_START,
    protected_main_sha: snapshot.protected_main_sha, captured_at: snapshot.captured_at,
    snapshot_digest: snapshot.record_digest, universe: "All main-target PRs open at/after approval or closed/merged after approval; #134 excluded; all open/merged categories require shadow observation",
    rows, shadow_skip: rows.filter(row => row.skipped).length, indeterminate: rows.filter(row => row.indeterminate).length });
}

export function assertCurrent(record, snapshot) {
  const row = auditWindow(snapshot).rows.find(row => row.pr_number === record.pr_number);
  requireValue(row && currentIdentity(record, row), "STALE_OBSERVATION");
  bind(record, snapshot.authority, Object.keys(AUTHORITY));
  return row;
}

cli(import.meta.url, () => {
  const opts = options(process.argv.slice(2), ["snapshot", "output"]);
  const result = auditWindow(readJson(opts.snapshot));
  writeJson(opts.output, result);
  if (result.shadow_skip || result.indeterminate) process.exitCode = 1;
});

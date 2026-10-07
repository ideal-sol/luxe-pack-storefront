import { AUTHORITY, CHECKS, REPOSITORY, authority, bind, cli, options, readJson, readRecords, requireValue, seal, writeJson } from "./shadow-common.mjs";
import { validateObservation } from "./shadow-observation.mjs";
import { auditWindow, currentIdentity } from "./shadow-window-audit.mjs";
import { validateInvalidation } from "./shadow-invalidation.mjs";
import { requirePublished, validateResolution } from "./shadow-publisher.mjs";

export function evaluateExit(observations, snapshot, { resolutions = [], invalidation = null } = {}) {
  const window = auditWindow(snapshot);
  requireValue(window.operational !== null, "MEASUREMENT_EVIDENCE_MISSING");
  requireValue(Array.isArray(observations) && Array.isArray(resolutions), "LEDGER_INVALID");
  const byId = new Map(), byHead = new Map();
  for (const record of observations) {
    validateObservation(record);
    requirePublished(record, window.rows.find(row => row.pr_number === record.pr_number), "observation");
    const previous = byId.get(record.observation_id);
    requireValue(!previous || previous.record_digest === record.record_digest, "DUPLICATE_OBSERVATION_ID");
    const headKey = `${record.pr_number}:${record.head_sha}`;
    requireValue(!byHead.has(headKey) || byHead.get(headKey) === record.record_digest, "CONFLICTING_PR_RECORD");
    byId.set(record.observation_id, record); byHead.set(headKey, record.record_digest);
  }
  const records = [...byId.values()];
  for (const row of window.rows) requireValue(row.historical_finalized_record_digests.every(digest => records.some(record => record.pr_number === row.pr_number && record.record_digest === digest)), "FINALIZED_HISTORY_OMITTED");
  const findings = records.flatMap(record => record.findings.map(finding => ({ ...finding, observation_digest: record.record_digest })));
  for (const row of window.rows) requireValue(row.resolution_record_digests.every(digest => resolutions.some(record => record.pr_number === row.pr_number && record.record_digest === digest)), "DURABLE_RESOLUTION_OMITTED");
  const resolved = new Map();
  for (const resolution of resolutions) {
    validateResolution(resolution);
    const publisher = requirePublished(resolution, window.rows.find(row => row.pr_number === resolution.pr_number), "resolution");
    const record = records.find(record => record.record_digest === resolution.observation_digest);
    requireValue(record, "RESOLUTION_OBSERVATION_MISSING"); bind(resolution, record);
    const finding = findings.find(finding => finding.finding_id === resolution.finding_id && finding.observation_digest === resolution.observation_digest);
    requireValue(finding, "RESOLUTION_FINDING_MISSING");
    requireValue(!resolved.has(finding.finding_id) || resolved.get(finding.finding_id) === resolution.record_digest, "CONFLICTING_RESOLUTION"); resolved.set(finding.finding_id, resolution.record_digest);
    finding.status = "RESOLVED"; finding.resolution_reference = resolution.resolution_reference;
    finding.resolution_publisher_evidence_reference = publisher.publisher_evidence_reference;
  }
  const stale = [], qualifying = [], current = [];
  for (const record of records) {
    const row = window.rows.find(row => row.pr_number === record.pr_number);
    requireValue(row, "OBSERVATION_OUTSIDE_INDEX");
    requireValue(row.historical_finalized_record_digests.includes(record.record_digest), "OBSERVATION_NOT_IN_HISTORY");
    if (!currentIdentity(record, row)) { stale.push(record.observation_id); continue; }
    if (!row.in_measurement_window || !row.operational_observations.some(entry =>
      entry.machine_record_digest === record.machine_record_digest && entry.generated_at === record.generated_at &&
      (entry.source !== "durable" || entry.observation_digest === record.record_digest))) continue;
    requireValue(row.finalized_record_digests.includes(record.record_digest), "FINALIZED_EVIDENCE_NOT_IN_WINDOW");
    requireValue(row.machine_record_digests.includes(record.machine_record_digest), "MACHINE_EVIDENCE_NOT_IN_WINDOW");
    requireValue(record.shadow_check_status === row.shadow_check_conclusion, "SHADOW_CHECK_CONTRADICTION");
    for (const name of CHECKS) requireValue(record.check_evidence.checks.find(check => check.name === name).conclusion === row.normal_ci_conclusions[name], "STALE_OR_CONTRADICTORY_NORMAL_CI");
    current.push(record);
    if (record.actual_change_qualifier && row.actual_credit_allowed && row.in_measurement_window && !row.exclusion_reason && row.category === "REAL_STOREFRONT" && row.state === "merged") qualifying.push(record);
  }
  // Findings from older heads stay open until explicitly resolved; a new success
  // cannot erase them. Older observations never contribute to actual counts.
  const open = kind => findings.filter(finding => finding.kind === kind && finding.status === "OPEN").length;
  const classes = [...new Set(qualifying.flatMap(record => record.change_classes))].sort();
  const failClosed = current.some(record => record.fail_closed_status === "PASS") && !records.some(record => record.fail_closed_status === "FAIL");
  const missingFinalization = window.rows.filter(row => row.in_measurement_window && !row.exclusion_reason && !current.some(record => record.pr_number === row.pr_number && record.machine_vs_human !== "NOT_COMPARABLE"));
  const counts = {
    qualifying_actual_changes: qualifying.length, distinct_change_classes: classes.length, change_classes: classes,
    critical_file_presentation_only: qualifying.filter(record => record.critical_components.length > 0 && record.human_evidence.critical_path && record.minor_eligibility_ground_truth === "ELIGIBLE_MINOR" && record.human_evidence.presentation_only_confirmed).length,
    unresolved_false_positive: open("FALSE_POSITIVE"), unresolved_false_negative: open("FALSE_NEGATIVE"),
    focused_acceptance_miss: open("FOCUSED_ACCEPTANCE_MISS"), normal_ci_comparison_problem: open("NORMAL_CI_PROBLEM"),
    shadow_skip: window.operational.shadow_skip, indeterminate: window.operational.indeterminate, measurement_boundary_unknown: window.operational.boundary_unknown, not_finalized: missingFinalization.length, stale_observations: stale.length,
  };
  if (invalidation) validateInvalidation(invalidation);
  const conditions = {
    actual_changes: counts.qualifying_actual_changes >= 5, change_classes: counts.distinct_change_classes >= 3,
    critical_presentation: counts.critical_file_presentation_only >= 1,
    false_positive: counts.unresolved_false_positive === 0, false_negative: counts.unresolved_false_negative === 0,
    fail_closed: failClosed, normal_ci_comparison: counts.normal_ci_comparison_problem === 0,
    focused_acceptance: counts.focused_acceptance_miss === 0, authority_reuse: qualifying.length >= 2,
    authority_invalidation: invalidation !== null, shadow_skip: counts.shadow_skip === 0,
    window_determinate: window.operational.indeterminate === 0, measurement_boundary: window.operational.boundary_unknown === 0, human_finalization: counts.not_finalized === 0,
  };
  authority(AUTHORITY);
  const gaps = Object.entries(conditions).filter(([, pass]) => !pass).map(([name]) => name);
  const evidenceProblem = ["false_positive", "false_negative", "normal_ci_comparison", "focused_acceptance", "shadow_skip", "window_determinate", "measurement_boundary"].some(key => !conditions[key]);
  return seal({ schema_version: "1.0", repository: REPOSITORY, authority: AUTHORITY, window,
    counts, conditions, blocking_gaps: gaps, findings, stale_observations: stale,
    authority_invalidation_digest: invalidation?.record_digest ?? null,
    status: gaps.length === 0 ? "SHADOW_EXIT_CANDIDATE" : evidenceProblem ? "SHADOW_EXIT_INCOMPLETE" : "SHADOW_ACCUMULATING",
    blocking_authority: false, fast_lane_production_enabled: false, phase_2_started: false, promotion: "NOT_STARTED" });
}

export function progress(result) {
  return ["Storefront Minor Fast Lane Shadow Exit Progress", `Actual changes: ${result.counts.qualifying_actual_changes} / 5`,
    `Change classes: ${result.counts.distinct_change_classes} / 3`, `Critical presentation example: ${result.counts.critical_file_presentation_only} / 1`,
    `False Positive unresolved: ${result.counts.unresolved_false_positive}`, `False Negative unresolved: ${result.counts.unresolved_false_negative}`,
    `Focused Acceptance misses: ${result.counts.focused_acceptance_miss}`, `Normal CI problems: ${result.counts.normal_ci_comparison_problem}`,
    ...["fail_closed", "authority_reuse", "authority_invalidation"].map(key => `${key}: ${result.conditions[key] ? "PASS" : "INCOMPLETE"}`),
    `Operational Shadow skips: ${result.counts.shadow_skip}`, `Measurement boundary unknown: ${result.counts.measurement_boundary_unknown}`, `Result: ${result.status}`].join("\n");
}

cli(import.meta.url, () => {
  const opts = options(process.argv.slice(2), ["observations", "window", "output"], ["resolutions", "invalidation"]);
  let result;
  try {
    result = evaluateExit(readRecords(opts.observations), readJson(opts.window), {
      resolutions: opts.resolutions ? readRecords(opts.resolutions) : [], invalidation: opts.invalidation ? readJson(opts.invalidation) : null });
  } catch (error) {
    result = seal({ schema_version: "1.0", authority: AUTHORITY, window: null, counts: null, conditions: {}, blocking_gaps: [error.message], status: "HOLD_EVIDENCE_INVALID" });
  }
  writeJson(opts.output, result);
  console.log(result.counts ? progress(result) : `HOLD_EVIDENCE_INVALID: ${result.blocking_gaps.join(", ")}`);
  if (["HOLD_EVIDENCE_INVALID", "SHADOW_EXIT_INCOMPLETE"].includes(result.status)) process.exitCode = 1;
});

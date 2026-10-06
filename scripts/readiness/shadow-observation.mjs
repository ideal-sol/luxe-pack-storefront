import { AUTHORITY, BINDING, CHECKS, SHADOW_CHECK, CLASSES, IDENTITY, REPOSITORY, authority, bind, canonical, cli, enumeration, exactKeys, identity, options, pick, readJson, requireValue, seal, string, strings, timestamp, verifySeal, writeJson } from "./shadow-common.mjs";

export function validateClassification(machine) {
  verifySeal(machine, "MACHINE_RECORD");
  authority(machine);
  identity({ ...machine, pr_number: 1 });
  requireValue(machine.schema_version === "1.0" && machine.repository === REPOSITORY && machine.policy_approval === "HUMAN_APPROVED", "MACHINE_AUTHORITY_INVALID");
  enumeration(machine.classification_state, ["ELIGIBLE", "NOT_ELIGIBLE", "UNCLASSIFIED", "INDETERMINATE"], "CLASSIFICATION");
  requireValue(string(machine.classification_reason) && machine.blocking_authority === false && machine.ci_skip === false && machine.production_impact === "NONE", "SHADOW_BOUNDARY_INVALID");
  for (const key of ["candidate_lane", "fallback_lane"]) enumeration(machine[key], ["NORMAL_STRICT_CI", "Normal Storefront Release", "Full Platform + Storefront Release"], "LANE");
  requireValue(machine.candidate_lane === machine.fallback_lane, "SHADOW_LANE_MISMATCH");
  for (const key of ["change_classes", "affected_modules", "affected_routes", "affected_states", "unknown_reasons"]) strings(machine[key], key);
  requireValue(machine.change_classes.every(value => CLASSES.includes(value)), "CHANGE_CLASS_INVALID");
  if (machine.critical_components !== undefined) strings(machine.critical_components, "CRITICAL_COMPONENTS");
  requireValue(Array.isArray(machine.evidence), "MACHINE_EVIDENCE_INVALID");
  for (const entry of machine.evidence) {
    requireValue(string(entry.path) && /^[0-9a-f]{64}$/.test(entry.before_digest) && /^[0-9a-f]{64}$/.test(entry.after_digest), "MACHINE_EVIDENCE_INVALID");
    strings(entry.classes, "EVIDENCE_CLASSES");
    requireValue(entry.classes.length > 0 && entry.classes.every(value => CLASSES.includes(value)), "EVIDENCE_CLASSES_INVALID");
  }
  if (machine.browser_acceptance_plan) verifySeal(machine.browser_acceptance_plan, "ACCEPTANCE_PLAN");
  if (machine.classification_state === "ELIGIBLE") requireValue(machine.browser_acceptance_plan && machine.change_classes.length > 0, "ELIGIBLE_PLAN_MISSING");
  return machine;
}

// An envelope binds the unchanged classifier record to its PR. No Human fields
// are inferred by this operation, including when classification is ELIGIBLE.
export function observe(machine, prNumber, generatedAt = new Date().toISOString()) {
  validateClassification(machine);
  identity({ ...machine, pr_number: prNumber });
  timestamp(generatedAt);
  return seal({ schema_version: "1.0", status: "PENDING_HUMAN", generated_at: generatedAt,
    ...pick(machine, ["repository", "base_sha", "head_sha", "tree_sha", ...Object.keys(AUTHORITY)]),
    pr_number: prNumber, machine_record_digest: machine.record_digest, machine });
}
export function validateEnvelope(envelope) {
  verifySeal(envelope, "MACHINE_OBSERVATION");
  requireValue(canonical(envelope) === canonical(observe(envelope.machine, envelope.pr_number, envelope.generated_at)), "MACHINE_ENVELOPE_MISMATCH");
}

// Plan IDs preserve the full ordered machine plan, including viewports/routes
// and breakpoints. Humans explicitly attest to these items and any extra impact.
export function plannedItems(machine) {
  const plan = machine.browser_acceptance_plan;
  if (!plan) return [];
  return Object.keys(plan).filter(key => !["record_digest", "schema_version", "status", "acceptance_reason"].includes(key)).sort()
    .flatMap(key => Array.isArray(plan[key]) ? plan[key].map(value => `${key}:${seal({ value }).record_digest}`) : []);
}

export function validateChecks(checks, expected) {
  verifySeal(checks, "CHECKS");
  bind(checks, expected, IDENTITY);
  requireValue(checks.schema_version === "1.0" && string(checks.evidence_reference), "CHECK_EVIDENCE_MISSING");
  requireValue(Array.isArray(checks.checks), "CHECKS_INVALID");
  const byName = new Map();
  for (const check of checks.checks) {
    requireValue(string(check.name) && !byName.has(check.name), "CONTRADICTORY_CI_EVIDENCE");
    requireValue(check.source_head_sha === expected.head_sha && string(check.evidence_reference), "CHECK_HEAD_MISMATCH");
    enumeration(check.conclusion, ["success", "failure", "cancelled", "timed_out", "skipped", "neutral", "action_required", "pending"], "CHECK_CONCLUSION");
    byName.set(check.name, check);
  }
  requireValue(byName.has(SHADOW_CHECK), "MISSING_EXPECTED_SHADOW_CHECK");
  requireValue(CHECKS.every(name => byName.has(name)), "NORMAL_CI_EVIDENCE_MISSING");
  return byName;
}

const humanKeys = ["schema_version", ...BINDING, "confirmed_by_role", "evidence_reference", "platform_impact_ground_truth", "minor_eligibility_ground_truth", "actual_change_qualifier", "change_kind", "critical_path", "presentation_only_confirmed", "focused_acceptance_result", "focused_acceptance_misses", "normal_ci_comparison", "fail_closed_observation", "human_notes", "record_digest"];
const nonActual = ["GATE_TOOLING", "SECURITY_OR_DEPENDENCY_ONLY", "SYNTHETIC", "TEST_ONLY", "DOCS_ONLY", "CI_ONLY"];

export function finalize(envelope, human, checks, finalizedAt = new Date().toISOString()) {
  validateEnvelope(envelope);
  verifySeal(human, "HUMAN");
  exactKeys(human, humanKeys, "HUMAN");
  requireValue(human.schema_version === "1.0" && human.confirmed_by_role === "human_operator" && string(human.evidence_reference), "HUMAN_EVIDENCE_REQUIRED");
  bind(human, envelope);
  const machine = envelope.machine;
  const byName = validateChecks(checks, envelope);
  enumeration(human.platform_impact_ground_truth, ["NONE", "PRESENT", "UNKNOWN"], "PLATFORM_GROUND_TRUTH");
  enumeration(human.minor_eligibility_ground_truth, ["ELIGIBLE_MINOR", "NOT_MINOR", "NOT_COMPARABLE"], "MINOR_GROUND_TRUTH");
  enumeration(human.change_kind, ["REAL_STOREFRONT", ...nonActual], "CHANGE_KIND");
  for (const key of ["actual_change_qualifier", "critical_path", "presentation_only_confirmed"]) requireValue(typeof human[key] === "boolean", `${key.toUpperCase()}_INVALID`);
  requireValue(typeof human.human_notes === "string", "HUMAN_NOTES_INVALID");
  if (human.actual_change_qualifier) requireValue(human.change_kind === "REAL_STOREFRONT" && machine.candidate_lane !== "NORMAL_STRICT_CI", "NON_ACTUAL_CHANGE");
  if (human.minor_eligibility_ground_truth === "ELIGIBLE_MINOR") requireValue(human.platform_impact_ground_truth !== "PRESENT", "CONTRADICTORY_GROUND_TRUTH");
  const acceptance = human.focused_acceptance_result;
  exactKeys(acceptance, ["plan_digest", "planned_items", "performed_items", "missed_items", "acceptance_complete", "evidence_reference"], "FOCUSED_ACCEPTANCE");
  requireValue(acceptance.plan_digest === (machine.browser_acceptance_plan?.record_digest ?? null), "ACCEPTANCE_PLAN_MISMATCH");
  for (const key of ["planned_items", "performed_items", "missed_items"]) strings(acceptance[key], key);
  requireValue(canonical(acceptance.planned_items) === canonical(plannedItems(machine)), "PLANNED_ITEMS_MISMATCH");
  requireValue(typeof acceptance.acceptance_complete === "boolean" && string(acceptance.evidence_reference), "ACCEPTANCE_EVIDENCE_MISSING");
  strings(human.focused_acceptance_misses, "FOCUSED_ACCEPTANCE_MISSES");
  requireValue(canonical([...acceptance.missed_items].sort()) === canonical([...human.focused_acceptance_misses].sort()), "ACCEPTANCE_MISSES_MISMATCH");
  if (acceptance.acceptance_complete) requireValue(acceptance.planned_items.every(item => acceptance.performed_items.includes(item)), "ACCEPTANCE_INCOMPLETE");
  const normalSuccess = CHECKS.every(name => byName.get(name).conclusion === "success");
  enumeration(human.normal_ci_comparison, ["PASS", "PROBLEM", "NOT_COMPARABLE"], "CI_COMPARISON");
  requireValue(normalSuccess || human.normal_ci_comparison !== "PASS", "CONTRADICTORY_CI_EVIDENCE");
  const failClosed = human.fail_closed_observation;
  exactKeys(failClosed, ["status", "cases", "evidence_reference"], "FAIL_CLOSED");
  enumeration(failClosed.status, ["PASS", "FAIL", "NOT_OBSERVED"], "FAIL_CLOSED_STATUS");
  strings(failClosed.cases, "FAIL_CLOSED_CASES");
  if (failClosed.status !== "NOT_OBSERVED") requireValue(failClosed.cases.length > 0 && string(failClosed.evidence_reference), "FAIL_CLOSED_EVIDENCE_MISSING");
  if (failClosed.status === "PASS") requireValue(machine.classification_state !== "ELIGIBLE", "FAIL_CLOSED_CONTRADICTION");
  const comparable = human.minor_eligibility_ground_truth !== "NOT_COMPARABLE" && human.platform_impact_ground_truth !== "UNKNOWN" && acceptance.acceptance_complete && human.normal_ci_comparison !== "NOT_COMPARABLE";
  const candidate = machine.classification_state === "ELIGIBLE";
  const comparison = !comparable ? "NOT_COMPARABLE" : candidate && human.minor_eligibility_ground_truth === "NOT_MINOR" ? "FALSE_POSITIVE" : !candidate && human.minor_eligibility_ground_truth === "ELIGIBLE_MINOR" ? "FALSE_NEGATIVE" : "AGREEMENT";
  const observationId = `${REPOSITORY}#${envelope.pr_number}:${envelope.head_sha}:${envelope.tree_sha}`;
  const findings = [];
  const finding = (kind, detail) => findings.push({ finding_id: `${observationId}:${kind}:${seal({ detail }).record_digest}`, kind, detail, status: "OPEN", resolution_reference: null });
  if (["FALSE_POSITIVE", "FALSE_NEGATIVE"].includes(comparison)) finding(comparison, comparison);
  for (const miss of acceptance.missed_items) finding("FOCUSED_ACCEPTANCE_MISS", miss);
  if (human.normal_ci_comparison === "PROBLEM" || !normalSuccess) finding("NORMAL_CI_PROBLEM", "NORMAL_CI_COMPARISON_PROBLEM");
  timestamp(finalizedAt);
  requireValue(Date.parse(finalizedAt) >= Date.parse(envelope.generated_at), "FINALIZATION_BEFORE_OBSERVATION");
  return seal({ schema_version: "1.0", observation_id: observationId, status: "FINALIZED", generated_at: envelope.generated_at, finalized_at: finalizedAt,
    ...pick(envelope, BINDING), ...pick(machine, ["classification_state", "classification_reason", "candidate_lane", "fallback_lane", "change_classes", "affected_modules", "affected_routes", "affected_states"]),
    machine_minor_candidate: candidate, critical_components: machine.critical_components ?? [],
    focused_acceptance_plan_digest: machine.browser_acceptance_plan?.record_digest ?? null,
    platform_impact_ground_truth: human.platform_impact_ground_truth, minor_eligibility_ground_truth: human.minor_eligibility_ground_truth,
    actual_change_qualifier: human.actual_change_qualifier && comparable, machine_vs_human: comparison,
    false_positive: comparison === "FALSE_POSITIVE", false_negative: comparison === "FALSE_NEGATIVE",
    fail_closed_status: failClosed.status, focused_acceptance_status: acceptance.acceptance_complete ? "COMPLETE" : "INCOMPLETE",
    focused_acceptance_misses: human.focused_acceptance_misses, normal_ci_status: normalSuccess ? "PASS" : "PROBLEM", normal_ci_comparison: human.normal_ci_comparison,
    shadow_check_status: byName.get(SHADOW_CHECK).conclusion, human_evidence_reference: human.evidence_reference,
    confirmed_by_role: human.confirmed_by_role, findings, machine_observation: envelope, human_evidence: human, check_evidence: checks });
}

export function validateObservation(record) {
  verifySeal(record, "OBSERVATION");
  const rebuilt = finalize(record.machine_observation, record.human_evidence, record.check_evidence, record.finalized_at);
  requireValue(canonical(rebuilt) === canonical(record), "OBSERVATION_DERIVATION_MISMATCH");
  return record;
}

export function commentEvidence(record) {
  validateObservation(record);
  return `<!-- shadow-observation:v1 -->\n\`\`\`json\n${canonical(record)}\n\`\`\`\n`;
}

cli(import.meta.url, () => {
  const [command, ...args] = process.argv.slice(2);
  if (command === "observe") {
    const opts = options(args, ["machine", "pr", "output"]);
    writeJson(opts.output, observe(readJson(opts.machine), Number(opts.pr)));
  } else if (command === "finalize") {
    const opts = options(args, ["machine", "human", "checks", "output"]);
    writeJson(opts.output, finalize(readJson(opts.machine), readJson(opts.human), readJson(opts.checks)));
  } else if (command === "comment") {
    const opts = options(args, ["observation"]);
    process.stdout.write(commentEvidence(readJson(opts.observation)));
  } else throw new Error("EXPECTED_OBSERVE_FINALIZE_OR_COMMENT");
});

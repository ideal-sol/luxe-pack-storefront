import { readFileSync } from "node:fs";
import { classifyDiff } from "./classifier.mjs";
import { AUTHORITY, IDENTITY, authority, bind, canonical, cli, options, requireValue, seal, verifySeal, writeJson } from "./shadow-common.mjs";
import { observe, validateEnvelope } from "./shadow-observation.mjs";

const implementationFiles = ["classifier.mjs", "shadow-common.mjs", "shadow-observation.mjs", "shadow-window-audit.mjs", "shadow-exit-evaluator.mjs", "shadow-github-adapter.mjs", "shadow-invalidation.mjs"];
const implementationDigest = () => seal(Object.fromEntries(implementationFiles.map(name => [name, readFileSync(new URL(name, import.meta.url), "utf8")]))).record_digest;
export const INVALIDATION_CASES = ["machine_digest", "policy_digest", "impact_map_digest", "base_sha", "head_sha", "tree_sha", "stale_observation", "authority_changing_event"];

// Controlled machine-only negative probes. No fabricated Human finalization,
// browser PASS, actual-change credit or incident is produced here.
export async function runInvalidation() {
  const machine = await classifyDiff({ base_sha: "a".repeat(40), head_sha: "b".repeat(40), tree_sha: "c".repeat(40), complete_diff: false });
  const envelope = observe(machine, 1, "2026-10-06T00:00:00.000Z");
  validateEnvelope(envelope);
  const cases = INVALIDATION_CASES.map(name => {
    let rejection = null;
    try {
      if (["machine_digest", "policy_digest", "impact_map_digest"].includes(name)) {
        const altered = structuredClone(envelope);
        if (name === "machine_digest") altered.machine.classification_reason = "ALTERED";
        else { altered.machine[name] = `sha256:${"0".repeat(64)}`; altered.machine = seal(altered.machine); altered.machine_record_digest = altered.machine.record_digest; altered[name] = altered.machine[name]; }
        validateEnvelope(seal(altered));
      } else if (["base_sha", "head_sha", "tree_sha", "stale_observation"].includes(name)) {
        const key = name === "stale_observation" ? "head_sha" : name;
        bind(envelope, { ...envelope, [key]: "d".repeat(40) }, IDENTITY);
      } else authority({ ...AUTHORITY, policy_version: "unapproved-authority-event" });
    } catch (error) { rejection = error.message; }
    requireValue(rejection !== null, `INVALIDATION_PROBE_ACCEPTED_${name}`);
    return { case: name, rejected: true, reason: rejection };
  });
  return seal({ schema_version: "1.0", kind: "CONTROLLED_NEGATIVE_VALIDATION", authority: AUTHORITY,
    implementation_digest: implementationDigest(), actual_change_count: 0, status: "PASS", cases });
}

export function validateInvalidation(evidence) {
  verifySeal(evidence, "INVALIDATION"); authority(evidence.authority);
  requireValue(evidence.schema_version === "1.0" && evidence.kind === "CONTROLLED_NEGATIVE_VALIDATION" && evidence.actual_change_count === 0 && evidence.status === "PASS", "INVALIDATION_EVIDENCE_INVALID");
  requireValue(evidence.implementation_digest === implementationDigest(), "STALE_INVALIDATION_EVIDENCE");
  requireValue(Array.isArray(evidence.cases) && canonical(evidence.cases.map(entry => entry.case)) === canonical(INVALIDATION_CASES) && evidence.cases.every(entry => entry.rejected === true && typeof entry.reason === "string" && entry.reason.length > 0), "INVALIDATION_CASES_INCOMPLETE");
}

cli(import.meta.url, async () => {
  const opts = options(process.argv.slice(2), ["output"]);
  writeJson(opts.output, await runInvalidation());
});

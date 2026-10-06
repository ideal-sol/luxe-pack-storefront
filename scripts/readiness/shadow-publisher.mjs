import { BINDING, REPOSITORY, authority, canonical, cli, enumeration, exactKeys, identity, options, readJson, requireValue, string, verifySeal } from "./shadow-common.mjs";
import { validateObservation } from "./shadow-observation.mjs";

// Human-approved Phase 1 publisher authority. Never sourced from CLI, record,
// snapshot allowlists, PR authors, role strings or repository permissions.
export const TRUSTED_SHADOW_EVIDENCE_PUBLISHERS = Object.freeze(["myong-ideal"]);
export const PUBLISHER_SNAPSHOT_VERSION = "1.1";
const kinds = ["observation", "resolution"];
const types = { issue_comment: "issuecomment", pull_request_review: "pullrequestreview" };
const provenanceKeys = ["repository", "pr_number", "evidence_kind", "record_digest", "publisher_login", "publisher_evidence_type", "publisher_evidence_id", "publisher_evidence_reference"];

export function validateResolution(resolution) {
  verifySeal(resolution, "RESOLUTION");
  exactKeys(resolution, ["schema_version", ...BINDING, "observation_digest", "finding_id", "status", "confirmed_by_role", "resolution_reference", "record_digest"], "RESOLUTION");
  identity(resolution); authority(resolution);
  requireValue(resolution.schema_version === "1.0" && resolution.confirmed_by_role === "human_operator" && resolution.status === "RESOLVED" && string(resolution.resolution_reference), "HUMAN_RESOLUTION_REQUIRED");
  requireValue(/^sha256:[0-9a-f]{64}$/.test(resolution.observation_digest) && /^sha256:[0-9a-f]{64}$/.test(resolution.machine_record_digest) && string(resolution.finding_id), "RESOLUTION_BINDING_INVALID");
}

export function validatePublisherProvenance(provenance, prNumber) {
  exactKeys(provenance, provenanceKeys, "PUBLISHER_PROVENANCE");
  requireValue(TRUSTED_SHADOW_EVIDENCE_PUBLISHERS.includes(provenance.publisher_login), "UNTRUSTED_HUMAN_EVIDENCE_PUBLISHER");
  requireValue(provenance.repository === REPOSITORY && provenance.pr_number === prNumber && Number.isSafeInteger(prNumber) && prNumber > 0, "PUBLISHER_PR_MISMATCH");
  enumeration(provenance.evidence_kind, kinds, "PUBLISHER_EVIDENCE_KIND");
  enumeration(provenance.publisher_evidence_type, Object.keys(types), "PUBLISHER_EVIDENCE_TYPE");
  requireValue(Number.isSafeInteger(provenance.publisher_evidence_id) && provenance.publisher_evidence_id > 0, "PUBLISHER_EVIDENCE_ID_INVALID");
  requireValue(provenance.publisher_evidence_reference === `https://github.com/${REPOSITORY}/pull/${prNumber}#${types[provenance.publisher_evidence_type]}-${provenance.publisher_evidence_id}`, "PUBLISHER_EVIDENCE_REFERENCE_MISMATCH");
  requireValue(/^sha256:[0-9a-f]{64}$/.test(provenance.record_digest), "PUBLISHER_RECORD_DIGEST_INVALID");
  return provenance;
}

// Only call with GitHub API response objects from the requested PR's comments
// or reviews endpoint. The publisher comes from API user.login, never the body.
export function recordsFromComments(comments, prNumber, evidenceKind = "observation", evidenceType = "issue_comment") {
  requireValue(Array.isArray(comments), "DURABLE_COMMENTS_INVALID");
  enumeration(evidenceKind, kinds, "PUBLISHER_EVIDENCE_KIND");
  enumeration(evidenceType, Object.keys(types), "PUBLISHER_EVIDENCE_TYPE");
  const marker = `<!-- shadow-${evidenceKind}:v1 -->`;
  const records = [], provenance = [], ignored = [];
  for (const comment of comments) {
    if (typeof comment.body !== "string" || !comment.body.includes(marker)) continue;
    if (!TRUSTED_SHADOW_EVIDENCE_PUBLISHERS.includes(comment.user?.login)) {
      // Check the publisher BEFORE parsing JSON: third parties cannot poison
      // the trusted evidence stream with malformed marker-bearing content.
      ignored.push({ reason: "UNTRUSTED_HUMAN_EVIDENCE_PUBLISHER", evidence_kind: evidenceKind,
        pr_number: prNumber, publisher_login: comment.user?.login ?? null, publisher_evidence_id: comment.id ?? null });
      continue;
    }
    const matches = [...comment.body.matchAll(new RegExp(`${marker}\\s*\`\`\`json\\s*([\\s\\S]*?)\\s*\`\`\``, "g"))];
    requireValue(matches.length > 0 && matches.length === comment.body.split(marker).length - 1, "DURABLE_COMMENT_MALFORMED");
    for (const match of matches) {
      const record = JSON.parse(match[1]);
      if (evidenceKind === "observation") validateObservation(record); else validateResolution(record);
      requireValue(record.pr_number === prNumber, "COMMENT_PR_MISMATCH");
      const publisher = validatePublisherProvenance({ repository: REPOSITORY, pr_number: prNumber,
        evidence_kind: evidenceKind, record_digest: record.record_digest, publisher_login: comment.user.login,
        publisher_evidence_type: evidenceType, publisher_evidence_id: comment.id,
        publisher_evidence_reference: comment.html_url }, prNumber);
      records.push(record); provenance.push(publisher);
    }
  }
  return { records, provenance, ignored };
}

export function requirePublished(record, row, kind) {
  requireValue(row && row.pr_number === record.pr_number, "PUBLISHER_PR_MISMATCH");
  const provenance = row.durable_evidence.find(entry => entry.evidence_kind === kind && entry.record_digest === record.record_digest);
  requireValue(provenance, "TRUSTED_DURABLE_PUBLISHER_PROVENANCE_REQUIRED");
  return validatePublisherProvenance(provenance, record.pr_number);
}

export function resolutionCommentEvidence(record) {
  validateResolution(record);
  return `<!-- shadow-resolution:v1 -->\n\`\`\`json\n${canonical(record)}\n\`\`\`\n`;
}

cli(import.meta.url, () => {
  const [command, ...args] = process.argv.slice(2);
  requireValue(command === "comment-resolution", "EXPECTED_COMMENT_RESOLUTION");
  const opts = options(args, ["resolution"]);
  process.stdout.write(resolutionCommentEvidence(readJson(opts.resolution)));
});

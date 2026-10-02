import { authorize, checkRuns, validateProvenance } from "../production-provenance.mjs";

function offlineGet(responses) {
  return async (path) => {
    if (!Object.hasOwn(responses, path)) throw new Error("OFFLINE_EVIDENCE_MISSING");
    return responses[path];
  };
}

export function replayRequiredChecks(responses, headSha) {
  return checkRuns(offlineGet(responses), headSha);
}

export function replaySourceAuthority(root, sourceSha, workflowSha, responses) {
  return authorize(root, sourceSha, workflowSha, offlineGet(responses));
}

export function verifyApprovedContract(root, explicitAuthority) {
  if (!explicitAuthority) throw new Error("EXPLICIT_CONTRACT_AUTHORITY_REQUIRED");
  return validateProvenance(root, explicitAuthority);
}

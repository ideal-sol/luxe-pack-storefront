import { execFileSync } from "node:child_process";
import { AUTHORITY, CHECKS, REPOSITORY, WINDOW_START, SHADOW_CHECK, canonical, cli, options, readJson, requireValue, seal, string, timestamp, writeJson } from "./shadow-common.mjs";
import { observe, validateEnvelope, validateObservation } from "./shadow-observation.mjs";
import { auditWindow, currentIdentity } from "./shadow-window-audit.mjs";

const prefix = `/repos/${REPOSITORY}`;
function matchesRun(run, pr) {
  if (run.head_sha !== pr.head.sha) return false;
  if (run.pull_requests?.length) return run.pull_requests.some(item => item.number === pr.number);
  // GitHub can remove PR associations after merge. Require the exact PR head,
  // event, source repository and branch before using these historical runs.
  return run.event === "pull_request" && string(pr.head.repo?.full_name) && string(pr.head.ref) && run.head_repository?.full_name === pr.head.repo.full_name && run.head_branch === pr.head.ref;
}
async function pages(get, path, key = null) {
  const result = [];
  for (let page = 1; page <= 10000; page++) {
    const response = await get(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    const items = key ? response[key] : response;
    requireValue(Array.isArray(items), "GITHUB_PAGE_INVALID");
    result.push(...items);
    if (items.length < 100) {
      if (key && response.total_count !== undefined) requireValue(response.total_count === result.length, "GITHUB_PAGINATION_INCOMPLETE");
      return result;
    }
  }
  throw new Error("GITHUB_PAGINATION_LIMIT");
}

export function recordsFromComments(comments) {
  const records = [];
  for (const comment of comments) {
    if (!comment.body?.includes("<!-- shadow-observation:v1 -->")) continue;
    const matches = [...comment.body.matchAll(/<!-- shadow-observation:v1 -->\s*```json\s*([\s\S]*?)\s*```/g)];
    requireValue(matches.length > 0, "DURABLE_COMMENT_MALFORMED");
    for (const match of matches) {
      const record = JSON.parse(match[1]);
      validateObservation(record);
      records.push(record);
    }
  }
  return records;
}

// get is an authenticated, read-only JSON transport. readArtifact optionally
// supplies already downloaded artifact JSON by verified artifact/run identity.
// Missing/expired transport never creates an observation or Human evidence.
export async function collectWindow(get, { readArtifact = async () => null, capturedAt = new Date().toISOString() } = {}) {
  const main = await get(`${prefix}/branches/main`);
  requireValue(main.protected === true, "PROTECTED_MAIN_REQUIRED");
  const start = await get(`${prefix}/commits/${WINDOW_START}`);
  const compare = await get(`${prefix}/compare/${WINDOW_START}...${main.commit.sha}`);
  requireValue(["ahead", "identical"].includes(compare.status), "WINDOW_START_NOT_ANCESTOR");
  for (const [file, digest] of [["minor-policy.v1.json", AUTHORITY.policy_digest], ["impact-map.v1.json", AUTHORITY.impact_map_digest]]) {
    const response = await get(`${prefix}/contents/scripts/readiness/${file}?ref=${main.commit.sha}`);
    // REST contents responses are base64; read-only connectors may return the
    // decoded JSON document. In either case the pinned canonical digest rules.
    const value = response.encoding === "base64" ? JSON.parse(Buffer.from(response.content, "base64").toString("utf8")) : response;
    requireValue(seal(value).record_digest === digest, "PROTECTED_MAIN_AUTHORITY_CHANGED");
  }
  const startedAt = start.commit.committer.date;
  const index = await pages(get, `${prefix}/pulls?state=all&base=main&sort=created&direction=asc`);
  const observations = [], machines = [], pullRequests = [];
  for (const entry of index) {
    if (entry.state === "closed" && Date.parse(entry.merged_at ?? entry.closed_at) <= Date.parse(startedAt) && entry.number !== 134) continue;
    const pr = await get(`${prefix}/pulls/${entry.number}`);
    const files = await pages(get, `${prefix}/pulls/${entry.number}/files`);
    requireValue(files.length === pr.changed_files, "GITHUB_DIFF_INCOMPLETE");
    const head = await get(`${prefix}/git/commits/${pr.head.sha}`);
    const comments = await pages(get, `${prefix}/issues/${entry.number}/comments`);
    const reviews = await pages(get, `${prefix}/pulls/${entry.number}/reviews`);
    const sealedRecords = recordsFromComments([...comments, ...reviews]);
    const identity = { repository: REPOSITORY, pr_number: pr.number, base_sha: pr.base.sha, head_sha: pr.head.sha, tree_sha: head.tree.sha };
    requireValue(sealedRecords.every(record => record.pr_number === pr.number), "COMMENT_PR_MISMATCH");
    observations.push(...sealedRecords);
    const runs = await pages(get, `${prefix}/actions/runs?event=pull_request&head_sha=${pr.head.sha}`, "workflow_runs");
    const associated = runs.filter(run => run.path === ".github/workflows/readiness-shadow.yml" && matchesRun(run, pr));
    associated.sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at) || right.id - left.id);
    const run = associated[0];
    const ciRun = runs.filter(run => run.path === ".github/workflows/ci.yml" && matchesRun(run, pr))
      .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at) || right.id - left.id)[0];
    const normalConclusions = {};
    if (ciRun) {
      const jobs = await pages(get, `${prefix}/actions/runs/${ciRun.id}/jobs`, "jobs");
      for (const job of jobs.filter(job => CHECKS.includes(job.name))) {
        requireValue(!Object.hasOwn(normalConclusions, job.name), "CONTRADICTORY_NORMAL_CI_JOBS");
        normalConclusions[job.name] = job.conclusion ?? "pending";
      }
    }
    let artifactExists = false;
    const digests = sealedRecords.filter(record => currentIdentity(record, identity)).map(record => record.machine_record_digest);
    if (run) {
      timestamp(run.created_at); timestamp(run.updated_at);
      const jobs = await pages(get, `${prefix}/actions/runs/${run.id}/jobs`, "jobs");
      const shadowJobs = jobs.filter(job => job.name === SHADOW_CHECK);
      requireValue(shadowJobs.length <= 1, "CONTRADICTORY_SHADOW_CHECKS");
      const artifacts = await pages(get, `${prefix}/actions/runs/${run.id}/artifacts`, "artifacts");
      for (const artifact of artifacts.filter(artifact => artifact.name === SHADOW_CHECK)) {
        artifactExists ||= !artifact.expired;
        const content = await readArtifact(artifact, pr, run);
        if (!content || Date.parse(run.created_at) < Date.parse(startedAt)) continue;
        const envelope = content["shadow-observation-machine.json"] ?? observe(content["readiness-shadow.json"], pr.number, run.created_at);
        validateEnvelope(envelope);
        requireValue(currentIdentity(envelope, identity), "ARTIFACT_SOURCE_MISMATCH");
        if (content["readiness-shadow.json"]) requireValue(envelope.machine_record_digest === content["readiness-shadow.json"].record_digest, "ARTIFACT_MACHINE_MISMATCH");
        digests.push(envelope.machine_record_digest); machines.push(envelope);
      }
      identity.shadow_check_conclusion = shadowJobs[0]?.conclusion ?? (shadowJobs.length ? "pending" : "missing");
    }
    pullRequests.push({ ...identity, base_ref: pr.base.ref, state: pr.merged_at ? "merged" : pr.state,
      created_at: pr.created_at, updated_at: pr.updated_at, merged_at: pr.merged_at, closed_at: pr.closed_at, merge_commit_sha: pr.merge_commit_sha,
      changed_files: [...new Set(files.flatMap(file => file.previous_filename && file.previous_filename !== file.filename ? [file.filename, file.previous_filename] : [file.filename]))], files_complete: true,
      shadow_workflow_triggered: Boolean(run), shadow_check_conclusion: identity.shadow_check_conclusion ?? "missing",
      shadow_source_head_sha: run?.head_sha ?? null, shadow_evidence_reference: run?.html_url ?? null,
      observation_artifact_exists: artifactExists, machine_record_digests: [...new Set(digests)],
      normal_ci_conclusions: normalConclusions,
      historical_finalized_record_digests: [...new Set(sealedRecords.map(record => record.record_digest))],
      finalized_record_digests: [...new Set(sealedRecords.filter(record => currentIdentity(record, identity)).map(record => record.record_digest))] });
    const fresh = await get(`${prefix}/pulls/${entry.number}`);
    requireValue(fresh.head.sha === pr.head.sha && fresh.base.sha === pr.base.sha && fresh.updated_at === pr.updated_at, "PR_CHANGED_DURING_COLLECTION");
  }
  const finalIndex = await pages(get, `${prefix}/pulls?state=all&base=main&sort=created&direction=asc`);
  requireValue(canonical(index.map(pr => [pr.number, pr.updated_at])) === canonical(finalIndex.map(pr => [pr.number, pr.updated_at])), "INDEX_CHANGED_DURING_COLLECTION");
  const freshMain = await get(`${prefix}/branches/main`);
  requireValue(freshMain.commit.sha === main.commit.sha && freshMain.protected === true, "MAIN_CHANGED_DURING_COLLECTION");
  const snapshot = seal({ schema_version: "1.0", repository: REPOSITORY, authority: AUTHORITY, start_authority: WINDOW_START,
    started_at: startedAt, captured_at: capturedAt, protected_main: true, protected_main_sha: main.commit.sha, start_is_ancestor: true,
    index_complete: true, pagination_complete: true, evidence_reference: `https://github.com/${REPOSITORY}/pulls`, pull_requests: pullRequests });
  auditWindow(snapshot);
  return { snapshot, observations, machines };
}

cli(import.meta.url, async () => {
  const opts = options(process.argv.slice(2), ["output", "observations-output", "machines-output"], ["responses", "artifacts"]);
  const responses = opts.responses ? readJson(opts.responses) : null;
  const artifacts = opts.artifacts ? readJson(opts.artifacts) : {};
  const get = async path => {
    if (responses) { requireValue(Object.hasOwn(responses, path), "OFFLINE_RESPONSE_MISSING"); return responses[path]; }
    return JSON.parse(execFileSync("gh", ["api", "--method", "GET", path], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
  };
  const result = await collectWindow(get, { readArtifact: async artifact => artifacts[String(artifact.id)] ?? null });
  writeJson(opts.output, result.snapshot); writeJson(opts["observations-output"], result.observations); writeJson(opts["machines-output"], result.machines);
});

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonical, seal, defaultPolicy, defaultImpact } from "./classifier.mjs";

export { canonical, seal };
export const REPOSITORY = "ideal-sol/luxe-pack-storefront";
export const WINDOW_START = "eead719007d3483ceb4e270a431f6c591430c2fc";
export const AUTHORITY = Object.freeze({
  policy_version: "1.1.2-operational-approved",
  policy_digest: "sha256:5f63edbed26a20a41e6fddde1ad74761348d45e4cfd3db611b0888bfefab938f",
  impact_map_version: "1.1",
  impact_map_digest: "sha256:a1bdc2acc38ad658588bbece10349e278eef419530611694b66b7bd77eca8118",
});
export const CHECKS = ["policy-gate", "quality-gate", "security-gate", "integration-gate", "ci-gate"];
export const SHADOW_CHECK = "storefront-readiness-shadow-observation";
export const CLASSES = defaultPolicy.allowed_change_classes;
export const IDENTITY = ["repository", "pr_number", "base_sha", "head_sha", "tree_sha"];
export const BINDING = [...IDENTITY, ...Object.keys(AUTHORITY), "machine_record_digest"];
export const string = value => typeof value === "string" && value.trim().length > 0;
export const sha = value => typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
export function requireValue(condition, reason) { if (!condition) throw new Error(reason); }
export function object(value, label) {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), `${label}_INVALID`);
}
export function strings(value, label) {
  requireValue(Array.isArray(value) && value.every(string) && new Set(value).size === value.length, `${label}_INVALID`);
}
export function enumeration(value, choices, label) { requireValue(choices.includes(value), `${label}_INVALID`); }
export function timestamp(value) { requireValue(string(value) && Number.isFinite(Date.parse(value)), "TIMESTAMP_INVALID"); }
export function verifySeal(value, label = "RECORD") {
  object(value, label);
  requireValue(value.record_digest === seal(value).record_digest, `${label}_DIGEST_MISMATCH`);
}
export function authority(value) {
  for (const [key, expected] of Object.entries(AUTHORITY)) requireValue(value[key] === expected, `${key.toUpperCase()}_MISMATCH`);
  requireValue(seal(defaultPolicy).record_digest === AUTHORITY.policy_digest &&
    seal(defaultImpact).record_digest === AUTHORITY.impact_map_digest && defaultPolicy.policy_approval === "HUMAN_APPROVED", "LOCAL_AUTHORITY_CHANGED");
}
export function identity(value) {
  requireValue(value.repository === REPOSITORY && Number.isSafeInteger(value.pr_number) && value.pr_number > 0, "PR_IDENTITY_INVALID");
  for (const key of ["base_sha", "head_sha", "tree_sha"]) requireValue(sha(value[key]), `${key.toUpperCase()}_INVALID`);
}
export function bind(value, expected, keys = BINDING) {
  for (const key of keys) requireValue(value[key] === expected[key], `${key.toUpperCase()}_MISMATCH`);
}
export function pick(value, keys) { return Object.fromEntries(keys.map(key => [key, value[key]])); }
export function exactKeys(value, keys, label) {
  object(value, label);
  requireValue(Object.keys(value).every(key => keys.includes(key)) && keys.every(key => Object.hasOwn(value, key)), `${label}_FIELDS_INVALID`);
}
export function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
export function writeJson(path, value) { writeFileSync(path, `${canonical(value)}\n`, { flag: "wx" }); }
export function readRecords(path) {
  if (statSync(path).isDirectory()) return readdirSync(path).filter(name => name.endsWith(".json")).sort().map(name => readJson(resolve(path, name)));
  const value = readJson(path);
  requireValue(Array.isArray(value), "OBSERVATIONS_MANIFEST_INVALID");
  return value;
}
export function options(args, required, optional = []) {
  requireValue(args.length % 2 === 0, "CLI_ARGUMENTS_INVALID");
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    requireValue(args[i] === `--${key}` && [...required, ...optional].includes(key) && !Object.hasOwn(result, key) && string(args[i + 1]), "CLI_ARGUMENTS_INVALID");
    result[key] = args[i + 1];
  }
  requireValue(required.every(key => result[key]), "CLI_ARGUMENTS_MISSING");
  return result;
}
export function cli(meta, run) {
  if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(meta)) {
    Promise.resolve().then(run).catch(error => { console.error(`HOLD_EVIDENCE_INVALID: ${error.message}`); process.exitCode = 1; });
  }
}

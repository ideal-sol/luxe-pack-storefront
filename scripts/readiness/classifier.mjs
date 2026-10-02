import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const policyDirectory = dirname(fileURLToPath(import.meta.url));
export const defaultPolicy = JSON.parse(readFileSync(resolve(policyDirectory, "minor-policy.v1.json"), "utf8"));
export const defaultImpact = JSON.parse(readFileSync(resolve(policyDirectory, "impact-map.v1.json"), "utf8"));
const normal = "Normal Storefront Release";
const full = "Full Platform + Storefront Release";
const minor = "Storefront Minor Change Fast Lane";
const fullSha = /^[0-9a-f]{40}$/;
const changeClasses = new Set(["scoped_css", "literal_className", "literal_inline_style", "noncritical_copy", "decorative_raster"]);

function requireValue(condition, reason) {
  if (!condition) throw new Error(reason);
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  requireValue(value !== undefined && !(typeof value === "number" && !Number.isFinite(value)), "NON_CANONICAL_VALUE");
  return JSON.stringify(value);
}

export function seal(value) {
  const payload = { ...value };
  delete payload.record_digest;
  return { ...payload, record_digest: `sha256:${createHash("sha256").update(`${canonical(payload)}\n`).digest("hex")}` };
}

function parse(path, content) {
  requireValue(!content.includes("\uFFFD"), "INVALID_UTF8");
  const tree = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  requireValue(tree.parseDiagnostics.length === 0, "PARSE_ERROR");
  return tree;
}

function safeCssValue(value, policy) {
  const constraints = policy.css_rule_constraints;
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value)) return true;
  if (value === "0") return true;
  return value.trim().split(/\s+/).every((part) => {
    const match = part.match(/^(\d+(?:\.\d+)?)(px|rem|em)$/);
    return match && constraints.numeric_units.includes(match[2]) && Number(match[1]) <= constraints.max_numeric_value;
  });
}

function classChange(before, after, policy, sources) {
  const oldTokens = before.trim().split(/\s+/).filter(Boolean);
  const newTokens = after.trim().split(/\s+/).filter(Boolean);
  const changed = [...oldTokens.filter((token) => !newTokens.includes(token)), ...newTokens.filter((token) => !oldTokens.includes(token))];
  requireValue(changed.length > 0, "CLASS_ORDER_UNCLASSIFIED");
  const allowed = new RegExp(policy.css_rule_constraints.allowed_class_pattern);
  requireValue(changed.every((token) => allowed.test(token)), "CLASS_OUTSIDE_POLICY");
  for (const source of Object.values(sources)) {
    if (!/querySelector|classList|getElementsByClassName|matches\s*\(|closest\s*\(/.test(source)) continue;
    requireValue(!changed.some((token) => source.includes(token)), "JS_SELECTOR_REFERENCED_CLASS");
    requireValue(!/querySelector(?:All)?\s*\(\s*[^'"`]/.test(source), "DYNAMIC_SELECTOR_UNKNOWN");
  }
}

function inlineStyle(node, policy) {
  requireValue(ts.isJsxExpression(node) && node.expression && ts.isObjectLiteralExpression(node.expression), "INLINE_STYLE_DYNAMIC");
  const properties = {};
  for (const property of node.expression.properties) {
    requireValue(ts.isPropertyAssignment(property) && ts.isIdentifier(property.name), "INLINE_STYLE_DYNAMIC");
    const name = property.name.text.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
    requireValue(policy.css_rule_constraints.allowed_properties.includes(name), "INLINE_STYLE_PROPERTY_FORBIDDEN");
    requireValue(ts.isStringLiteral(property.initializer) || ts.isNumericLiteral(property.initializer), "INLINE_STYLE_DYNAMIC");
    const value = ts.isNumericLiteral(property.initializer) ? `${property.initializer.text}px` : property.initializer.text;
    requireValue(safeCssValue(value, policy), "INLINE_STYLE_VALUE_FORBIDDEN");
    requireValue(!(name in properties), "INLINE_STYLE_DUPLICATE");
    properties[name] = value;
  }
  return properties;
}

export function compareTsx(path, before, after, policy, sources) {
  const oldTree = parse(path, before);
  const newTree = parse(path, after);
  const classes = new Set();
  const critical = policy.critical_paths.some((prefix) => path.startsWith(prefix));
  function compare(oldNode, newNode) {
    requireValue(oldNode.kind === newNode.kind, "DOM_OR_LOGIC_STRUCTURE_CHANGED");
    if (oldNode.getText(oldTree) === newNode.getText(newTree)) return;
    if (ts.isJsxAttribute(oldNode) && ts.isJsxAttribute(newNode) && oldNode.name.text === newNode.name.text) {
      if (oldNode.name.text === "className") {
        requireValue(oldNode.initializer && newNode.initializer && ts.isStringLiteral(oldNode.initializer)
          && ts.isStringLiteral(newNode.initializer), "CLASS_EXPRESSION_CHANGED");
        classChange(oldNode.initializer.text, newNode.initializer.text, policy, sources);
        classes.add("literal_className");
        return;
      }
      if (oldNode.name.text === "style") {
        inlineStyle(oldNode.initializer, policy);
        inlineStyle(newNode.initializer, policy);
        classes.add("literal_inline_style");
        return;
      }
    }
    if (ts.isJsxText(oldNode) && ts.isJsxText(newNode)) {
      const parent = oldNode.parent;
      const tag = ts.isJsxElement(parent) ? parent.openingElement.tagName.getText(oldTree) : "";
      requireValue(!critical && ["p", "span", "h1", "h2", "h3"].includes(tag)
        && oldNode.text.trim() && newNode.text.trim(), "CRITICAL_OR_STRUCTURAL_COPY_CHANGE");
      classes.add("noncritical_copy");
      return;
    }
    const oldChildren = oldNode.getChildren(oldTree);
    const newChildren = newNode.getChildren(newTree);
    requireValue(oldChildren.length > 0 && oldChildren.length === newChildren.length, "LOGIC_OR_DOM_CHANGED");
    oldChildren.forEach((child, index) => compare(child, newChildren[index]));
  }
  compare(oldTree, newTree);
  requireValue(classes.size > 0, "UNCLASSIFIED");
  return [...classes];
}

function cssRules(content) {
  requireValue(!/\/\*|@|\\|!important|var\(|url\(/i.test(content), "CSS_COMPLEX_OR_GLOBAL");
  const rules = [];
  let consumed = "";
  for (const match of content.matchAll(/(\.[a-zA-Z][\w-]*)\s*\{([^{}]*)\}/g)) {
    consumed += match[0];
    const declarations = {};
    for (const declaration of match[2].split(";").map((entry) => entry.trim()).filter(Boolean)) {
      const parts = declaration.match(/^([a-z-]+)\s*:\s*([^:;]+)$/);
      requireValue(parts && !(parts[1] in declarations), "CSS_DECLARATION_INVALID");
      declarations[parts[1]] = parts[2].trim();
    }
    rules.push({ selector: match[1], declarations });
  }
  requireValue(rules.length > 0 && consumed.replace(/\s/g, "") === content.replace(/\s/g, ""), "CSS_UNCLASSIFIED_SELECTOR");
  return rules;
}

export function compareCss(path, before, after, policy, sources) {
  requireValue(path.endsWith(".module.css"), "GLOBAL_STYLE_REJECTED");
  const oldRules = cssRules(before);
  const newRules = cssRules(after);
  requireValue(oldRules.length === newRules.length, "CSS_SELECTOR_STRUCTURE_CHANGED");
  let changed = false;
  oldRules.forEach((rule, index) => {
    const next = newRules[index];
    requireValue(rule.selector === next.selector, "CSS_SELECTOR_CHANGED");
    for (const name of new Set([...Object.keys(rule.declarations), ...Object.keys(next.declarations)])) {
      if (rule.declarations[name] === next.declarations[name]) continue;
      changed = true;
      requireValue(policy.css_rule_constraints.allowed_properties.includes(name), "CSS_PROPERTY_FORBIDDEN");
      requireValue([rule.declarations[name], next.declarations[name]].every((value) => value === undefined || safeCssValue(value, policy)), "CSS_VALUE_FORBIDDEN");
      requireValue(!Object.values(sources).some((source) => /querySelector|classList|getElementsByClassName/.test(source)
        && source.includes(rule.selector.slice(1))), "JS_SELECTOR_REFERENCED_CLASS");
    }
  });
  requireValue(changed, "UNCLASSIFIED");
  return ["scoped_css"];
}

function importTargets(path, content, files) {
  if (!/\.tsx?$/.test(path)) return [];
  const tree = parse(path, content);
  const targets = [];
  function visit(node) {
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(tree) === "require")) {
      requireValue(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]), "DYNAMIC_IMPORT_UNKNOWN");
      resolveImport(node.arguments[0].text);
    }
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) resolveImport(node.moduleSpecifier.text);
    ts.forEachChild(node, visit);
  }
  function resolveImport(specifier) {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return;
    const base = specifier.startsWith("@/") ? `src/${specifier.slice(2)}` : posix.normalize(posix.join(posix.dirname(path), specifier));
    const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((entry) => files.has(entry));
    requireValue(target, "UNRESOLVED_SHARED_IMPORT");
    targets.push(target);
  }
  visit(tree);
  return targets;
}

export function impactFor(paths, sources, impact = defaultImpact, policy = defaultPolicy, inventory = Object.keys(sources)) {
  const affected = new Set(paths);
  const files = new Set(inventory);
  const imports = new Map(Object.entries(sources).map(([path, source]) => [path, importTargets(path, source, files)]));
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const [path, targets] of imports) {
      if (!affected.has(path) && targets.some((target) => affected.has(target))) {
        affected.add(path);
        expanded = true;
      }
    }
  }
  const areas = impact.areas.filter((area) => [...affected].some((path) => area.paths.some((prefix) => path.startsWith(prefix))));
  requireValue(paths.every((path) => areas.some((area) => area.paths.some((prefix) => path.startsWith(prefix)))
    || [...affected].some((entry) => entry.startsWith("src/app/") && entry.endsWith("/page.tsx"))), "UNMAPPED_IMPACT");
  const routes = new Set(areas.flatMap((area) => area.affected_routes).filter((route) => route !== "*"));
  for (const path of affected) {
    if (/^src\/app\/.*page\.tsx$/.test(path)) routes.add(`/${path.slice(8).replace(/(?:^|\/)page\.tsx$/, "").replace(/\([^/]+\)\//g, "")}`.replace(/\/$/, "") || "/");
  }
  if (areas.some((area) => area.affected_routes.includes("*"))) {
    for (const path of files) if (path.startsWith("src/app/") && path.endsWith("page.tsx")) routes.add(`/${path.slice(8).replace(/(?:^|\/)page\.tsx$/, "")}`.replace(/\/$/, "") || "/");
    if (!routes.size) routes.add("/");
  }
  const states = [...new Set(areas.flatMap((area) => area.affected_states))].sort();
  return {
    affected_modules: areas.map((area) => area.area).sort(), affected_components: [...affected].sort(),
    affected_routes: [...routes].sort(), affected_states: states,
    browser_acceptance_plan: seal({ schema_version: "1.0", affected_routes: [...routes].sort(),
      affected_components: [...affected].sort(), affected_states: states,
      required_viewport_classes: policy.shared_impact_rules.viewport_classes,
      acceptance_reason: "Changed presentation and transitive importer contexts; critical screens retain focused acceptance",
      status: "HUMAN_BROWSER_ACCEPTANCE_PENDING" }),
  };
}

async function compareRaster(path, before, after, policy) {
  requireValue(policy.asset_constraints.paths.some((prefix) => path.startsWith(prefix)), "BUSINESS_ASSET_REJECTED");
  const constraints = policy.asset_constraints;
  requireValue(after.length <= constraints.max_bytes && after.length <= before.length * constraints.max_growth_ratio, "ASSET_SIZE_LIMIT");
  const requireNext = createRequire(import.meta.resolve("next/package.json"));
  const sharp = requireNext("sharp");
  const metadata = [];
  for (const bytes of [before, after]) {
    const instance = sharp(bytes, { limitInputPixels: constraints.max_width * constraints.max_height, animated: true });
    const info = await instance.metadata();
    requireValue(constraints.formats.includes(info.format) && info.width <= constraints.max_width
      && info.height <= constraints.max_height && (info.pages ?? 1) === 1, "ASSET_FORMAT_OR_DIMENSION");
    await instance.raw().toBuffer();
    metadata.push(info);
  }
  requireValue(metadata[0].format === metadata[1].format && metadata[0].width === metadata[1].width
    && metadata[0].height === metadata[1].height, "ASSET_DIMENSION_CHANGED");
  return ["decorative_raster"];
}

export async function classifyDiff(input, policy = defaultPolicy, impact = defaultImpact) {
  const record = {
    schema_version: "1.0", repository: "ideal-sol/luxe-pack-storefront",
    base_sha: input.base_sha ?? null, head_sha: input.head_sha ?? null, tree_sha: input.tree_sha ?? null,
    policy_version: policy.policy_version, policy_digest: seal(policy).record_digest,
    impact_map_version: impact.map_version, impact_map_digest: seal(impact).record_digest,
    policy_approval: policy.approved_by_role === "human_operator" && typeof policy.approved_at === "string"
      && Number.isFinite(Date.parse(policy.approved_at)) ? "HUMAN_APPROVED" : "PENDING_HUMAN_APPROVAL",
    candidate_lane: normal, fallback_lane: normal, classification_reason: "UNCLASSIFIED",
    evidence: [], unknown_reasons: [], change_classes: [], affected_modules: [], affected_routes: [], affected_states: [],
    production_impact: "NONE", blocking_authority: false, ci_skip: false,
  };
  try {
    requireValue([input.base_sha, input.head_sha, input.tree_sha].every((sha) => fullSha.test(sha)), "BASELINE_IDENTITY_INVALID");
    requireValue(input.complete_diff === true && Array.isArray(input.changes) && input.changes.length > 0, "INCOMPLETE_DIFF");
    requireValue(input.baseline_matches === true, "BASELINE_MISMATCH");
    requireValue(input.platform_impact === "NONE", "PLATFORM_IMPACT_UNKNOWN");
    requireValue(policy.policy_version && policy.allowed_change_classes.every((entry) => changeClasses.has(entry))
      && policy.forbidden_change_classes.length > 0 && policy.critical_symbols.length > 0, "UNKNOWN_MACHINE_POLICY_CLASS");
    const classes = new Set();
    const paths = [];
    const sources = { ...input.base_sources, ...input.head_sources };
    for (const change of input.changes) {
      const path = change.path;
      requireValue(typeof path === "string" && !path.includes("..") && !path.startsWith("/"), "INVALID_PATH");
      requireValue(change.status === "M" && change.old_mode === "100644" && change.new_mode === "100644", "ADD_REMOVE_RENAME_MODE_CHANGE");
      requireValue(!/^(?:\.github\/|scripts\/|docs\/|vendor\/)|(?:package\.json|lock|config|proxy|middleware|\.env)/i.test(path), "POLICY_CONTRACT_CONFIG_OR_ROUTING_CHANGE");
      paths.push(path);
      let found;
      if (path.endsWith(".tsx") && path.startsWith("src/")) {
        found = compareTsx(path, change.before.toString("utf8"), change.after.toString("utf8"), policy, sources);
      } else if (path.endsWith(".css") && path.startsWith("src/")) {
        found = compareCss(path, change.before.toString("utf8"), change.after.toString("utf8"), policy, sources);
      } else if (/\.(png|jpe?g|webp)$/i.test(path)) {
        found = await compareRaster(path, change.before, change.after, policy);
      } else {
        throw new Error("UNCLASSIFIED");
      }
      requireValue(found.every((entry) => policy.allowed_change_classes.includes(entry)), "UNKNOWN_MACHINE_POLICY_CLASS");
      found.forEach((entry) => classes.add(entry));
      record.evidence.push({ path, classes: found, before_digest: createHash("sha256").update(change.before).digest("hex"),
        after_digest: createHash("sha256").update(change.after).digest("hex") });
    }
    const oldImpact = impactFor(paths, input.base_sources, impact, policy, input.base_inventory);
    const newImpact = impactFor(paths, input.head_sources, impact, policy, input.head_inventory);
    Object.assign(record, newImpact);
    for (const key of ["affected_modules", "affected_components", "affected_routes", "affected_states"]) record[key] = [...new Set([...oldImpact[key], ...newImpact[key]])].sort();
    record.browser_acceptance_plan = seal({ ...newImpact.browser_acceptance_plan,
      affected_components: record.affected_components, affected_routes: record.affected_routes, affected_states: record.affected_states });
    record.change_classes = [...classes].sort();
    requireValue(!classes.has("noncritical_copy") || !record.affected_components.some((component) =>
      policy.critical_paths.some((prefix) => component.startsWith(prefix))), "CRITICAL_COPY_SHARED_IMPACT");
    requireValue(record.policy_approval === "HUMAN_APPROVED", "MACHINE_POLICY_APPROVAL_PENDING");
    record.candidate_lane = minor;
    record.classification_reason = "AST_CSS_ASSET_AND_SHARED_IMPACT_PROVEN";
  } catch (error) {
    const code = error instanceof Error && /^[A-Z][A-Z_]+$/.test(error.message) ? error.message : "CLASSIFIER_ERROR";
    record.unknown_reasons.push(code);
    record.classification_reason = "UNCLASSIFIED";
    if (input.platform_impact !== "NONE") record.candidate_lane = record.fallback_lane = full;
    if (input.changes?.some((change) => /^(?:scripts\/|\.github\/)/.test(change.path))) record.fallback_lane = "NORMAL_STRICT_CI";
  }
  return seal(record);
}

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

export function gitInput(root, base, head) {
  requireValue(fullSha.test(base) && fullSha.test(head), "BASELINE_IDENTITY_INVALID");
  requireValue(git(root, "rev-parse", "HEAD").toString().trim() === head, "BASELINE_MISMATCH");
  requireValue(git(root, "status", "--porcelain").length === 0, "WORKTREE_NOT_CLEAN");
  const diff = git(root, "diff", "--raw", "--no-abbrev", "--no-renames", "-z", base, head).toString().split("\0").filter(Boolean);
  const changes = [];
  for (let index = 0; index < diff.length; index += 2) {
    const metadata = diff[index].split(" ");
    const path = diff[index + 1];
    changes.push({ path, status: metadata[4], old_mode: metadata[0].slice(1), new_mode: metadata[1],
      before: metadata[4] === "M" ? git(root, "show", `${base}:${path}`) : Buffer.alloc(0),
      after: metadata[4] === "M" ? git(root, "show", `${head}:${path}`) : Buffer.alloc(0) });
  }
  const inventory = (sha) => git(root, "ls-tree", "-r", "--name-only", "-z", sha, "src").toString().split("\0").filter(Boolean);
  const sources = (sha, paths) => Object.fromEntries(paths.filter((path) => /\.tsx?$/.test(path) && !path.startsWith("src/test/"))
    .map((path) => [path, git(root, "show", `${sha}:${path}`).toString("utf8")]));
  const baseInventory = inventory(base);
  const headInventory = inventory(head);
  return { base_sha: base, head_sha: head, tree_sha: git(root, "rev-parse", `${head}^{tree}`).toString().trim(),
    complete_diff: true, baseline_matches: git(root, "merge-base", base, head).toString().trim() === base,
    platform_impact: "UNKNOWN", changes, base_inventory: baseInventory, head_inventory: headInventory,
    base_sources: sources(base, baseInventory), head_sources: sources(head, headInventory) };
}

export function applyHandoff(input, handoff) {
  requireValue(handoff.schema_version === "1.0" && handoff.repository === "ideal-sol/luxe-pack-storefront"
    && handoff.base_sha === input.base_sha && handoff.head_sha === input.head_sha
    && handoff.tree_sha === input.tree_sha && handoff.platform_impact === "NONE"
    && typeof handoff.evidence_reference === "string" && handoff.evidence_reference.trim().length > 0
    && handoff.confirmed_by_role === "human_operator", "HANDOFF_IDENTITY_OR_EVIDENCE_INVALID");
  requireValue(handoff.record_digest === seal(handoff).record_digest, "HANDOFF_DIGEST_MISMATCH");
  return { ...input, platform_impact: "NONE", platform_impact_evidence: handoff.evidence_reference };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [root, base, head, output, handoffPath] = process.argv.slice(2);
  let result;
  try {
    const input = gitInput(root, base, head);
    if (handoffPath) {
      requireValue(handoffPath.endsWith(".json"), "HANDOFF_PATH_INVALID");
      const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
      result = await classifyDiff(applyHandoff(input, handoff), handoff.machine_policy ?? defaultPolicy);
    } else {
      result = await classifyDiff(input);
    }
  } catch {
    result = seal({ schema_version: "1.0", candidate_lane: full, fallback_lane: full,
      unknown_reasons: ["INPUT_OR_GIT_UNAVAILABLE"], production_impact: "NONE", blocking_authority: false });
  }
  writeFileSync(output, `${canonical(result)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ candidate_lane: result.candidate_lane, production_impact: "NONE" }));
}

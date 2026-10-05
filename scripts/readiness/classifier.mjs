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
const requireNext = createRequire(import.meta.resolve("next/package.json"));
const postcss = requireNext("postcss");
const fullSha = /^[0-9a-f]{40}$/;
const changeClasses = new Set(["scoped_css", "literal_className", "literal_inline_style", "text_only_copy", "static_raster"]);

function requireValue(condition, reason, state = "UNCLASSIFIED") {
  if (!condition) throw Object.assign(new Error(reason), { state });
}
const reject = (condition, reason) => requireValue(condition, reason, "NOT_ELIGIBLE");
const matchesAny = (text, patterns) => patterns.some((pattern) => new RegExp(pattern).test(text));

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
function cssTree(content) {
  try { return postcss.parse(content); } catch { requireValue(false, "CSS_PARSE_ERROR"); }
}
function cssValue(name, value, policy) {
  const rule = policy.css.properties[name];
  reject(Boolean(rule), "CSS_PROPERTY_INITIAL_NORMAL");
  requireValue(typeof value === "string" && !/var\(|calc\(|env\(|\\/i.test(value), "CSS_VALUE_UNRESOLVED");
  if (rule.kind === "color") {
    // Parse a color in an isolated declaration, never via DOM or runtime CSS.
    const hex = new RegExp(rule.hex_pattern, "i").test(value);
    const keywords = rule.keywords.includes(value.toLowerCase());
    const rgb = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?|\.\d+))?\s*\)$/i);
    requireValue(hex || keywords || (rgb && rgb.slice(1, 4).every((v) => Number(v) >= rule.rgb_channel_bounds[0] && Number(v) <= rule.rgb_channel_bounds[1])), "CSS_COLOR_UNRESOLVED");
    return;
  }
  requireValue(rule.kind === "numeric", "UNKNOWN_CSS_POLICY_KIND");
  if (rule.keywords?.includes(value)) return;
  const parts = value.trim().split(/\s+/);
  reject(parts.length <= rule.max_components, "CSS_COMPONENT_COUNT");
  for (const part of parts) {
    const match = part.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em)?$/);
    requireValue(match, "CSS_UNIT_OR_VALUE_UNRESOLVED");
    const number = Number(match[1]);
    const unit = match[2] ?? "";
    if (unit === "" && number === 0 && rule.unitless_zero) continue;
    requireValue(rule.units[unit], "CSS_UNIT_UNRESOLVED");
    reject(number >= rule.units[unit][0] && number <= rule.units[unit][1], "CSS_NUMERIC_BOUND");
  }
}
function safeSelector(selector, policy) {
  reject(!new RegExp(policy.css.normal_selector_pattern, "i").test(selector), "CSS_SELECTOR_INITIAL_NORMAL");
  requireValue(!/[\\&]/.test(selector), "CSS_SELECTOR_UNRESOLVED");
}
function safeCssContext(node, policy, details) {
  for (let parent = node.parent; parent && parent.type !== "root"; parent = parent.parent) {
    if (parent.type === "rule") safeSelector(parent.selector, policy);
    else if (parent.type === "atrule") {
      reject(!matchesAny(parent.name, policy.css.normal_at_rule_patterns), "CSS_AT_RULE_INITIAL_NORMAL");
      reject(!new RegExp(policy.css.normal_media_pattern, "i").test(parent.params), "CSS_MEDIA_INITIAL_NORMAL");
      requireValue(parent.name === "media", "CSS_AT_RULE_UNSUPPORTED");
      details.breakpoints.add(parent.params);
    }
  }
}
function checkSelectorUsage(tokens, sources) {
  for (const [path, source] of Object.entries(sources)) {
    if (!/\.tsx?$/.test(path)) continue;
    const tree = parse(path, source);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && /^(querySelector|querySelectorAll|matches|closest|getElementsByClassName|add|remove|toggle|contains)$/.test(node.expression.name.text)) {
        const receiver = node.expression.expression.getText(tree);
        if (/^(add|remove|toggle|contains)$/.test(node.expression.name.text) && !receiver.endsWith("classList")) return;
        requireValue(node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0]), "DYNAMIC_SELECTOR_UNKNOWN");
        reject(!tokens.some((token) => node.arguments[0].text.includes(token)), "JS_SELECTOR_REFERENCED_CLASS");
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
}
function classChange(before, after, policy, sources, details) {
  const oldTokens = before.trim().split(/\s+/).filter(Boolean);
  const newTokens = after.trim().split(/\s+/).filter(Boolean);
  const changed = [...new Set([...oldTokens.filter((token) => !newTokens.includes(token)), ...newTokens.filter((token) => !oldTokens.includes(token))])];
  requireValue(changed.length > 0, "CLASS_ORDER_UNCLASSIFIED");
  checkSelectorUsage(changed, sources);
  for (const token of changed) {
    requireValue(/^[a-zA-Z_][\w-]*$/.test(token), "CLASS_STYLE_UNRESOLVED");
    let found = false;
    for (const [path, source] of Object.entries(sources)) {
      if (!path.endsWith(".css")) continue;
      const tree = cssTree(source);
      tree.walkAtRules("import", () => requireValue(false, "CLASS_STYLE_DEPENDENCY_UNRESOLVED"));
      tree.walkRules((rule) => {
        if (!(rule.selector.match(/\.[\w-]+/g) ?? []).includes(`.${token}`)) return;
        found = true;
        safeSelector(rule.selector, policy);
        safeCssContext(rule, policy, details);
        rule.walkDecls((decl) => {
          reject(!decl.important, "CSS_IMPORTANT_INITIAL_NORMAL");
          cssValue(decl.prop, decl.value, policy);
        });
        requireValue(rule.nodes.every((node) => ["decl", "comment"].includes(node.type)), "CLASS_NESTED_STYLE_UNRESOLVED");
      });
    }
    requireValue(found, "CLASS_STYLE_UNRESOLVED");
  }
}
function inlineStyle(node, policy) {
  requireValue(node && ts.isJsxExpression(node) && node.expression && ts.isObjectLiteralExpression(node.expression), "INLINE_STYLE_DYNAMIC");
  const names = new Set();
  for (const property of node.expression.properties) {
    requireValue(ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)), "INLINE_STYLE_DYNAMIC");
    const name = property.name.text.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    requireValue(!names.has(name), "INLINE_STYLE_DUPLICATE");
    names.add(name);
    const value = property.initializer;
    requireValue(ts.isStringLiteral(value) || ts.isNumericLiteral(value) || (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(value.operand)), "INLINE_STYLE_DYNAMIC");
    const text = ts.isStringLiteral(value) ? value.text : `${value.getText()}${["line-height", "font-weight"].includes(name) ? "" : "px"}`;
    cssValue(name, text, policy);
  }
}
// Diagnostic names describe rejected AST nodes; they never grant eligibility.
const diagnosticCalls = {
  "event_handler": "^on[A-Z]",
  "hooks": "^use[A-Z]",
  "effects": "^use(?:Effect|LayoutEffect|InsertionEffect)$",
  "state_mutation": "^(?:set[A-Z]|mutate|dispatch)",
  "navigation": "^(?:push|replace|redirect|navigate|back|forward|refresh|.*Route)$",
  "api": "^(?:fetch|request|get[A-Z]|list[A-Z])",
  "mutation_write": "^(?:post|put|patch|delete|submit|create|update|remove|exchange|draw|purchase|save|register|confirm)",
  "payload": "^(?:payload|body|request|params|input|data)$",
  "authentication_session": "(?:[Aa]uth|[Ss]ession|[Ll]ogin|[Ll]ogout|[Cc]srf|[Tt]oken)",
  "payment_security": "(?:[Pp]ayment|[Cc]ard|[Ff]incode|[Ss]anitize|[Ss]ecurity|[Pp]assword|[Vv]erify)"
};
function logicCategories(node, tree) {
  const categories = new Set();
  for (let current = node; current; current = current.parent) {
    if (ts.isJsxAttribute(current) && new RegExp(diagnosticCalls.event_handler).test(current.name.getText(tree))) categories.add("event_handler");
    if (ts.isConditionalExpression(current) || ts.isIfStatement(current) || ts.isSwitchStatement(current)
        || ts.isBinaryExpression(current) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(current.operatorToken.kind)) categories.add("conditional_control_flow");
    if (ts.isBinaryExpression(current) && current.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && current.operatorToken.kind <= ts.SyntaxKind.LastAssignment
        || ts.isPostfixUnaryExpression(current) || ts.isPrefixUnaryExpression(current) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(current.operator)) categories.add("state_mutation");
    if (ts.isObjectLiteralExpression(current)) categories.add("payload");
    if (ts.isCallExpression(current)) {
      const name = ts.isPropertyAccessExpression(current.expression) ? current.expression.name.text : current.expression.getText(tree);
      for (const [category, pattern] of Object.entries(diagnosticCalls)) if (new RegExp(pattern).test(name)) categories.add(category);
    }
  }
  return categories.size ? [...categories].sort() : ["logic_or_dom_structure"];
}
function displayLiteral(node, tree, policy) {
  let current = node;
  while (current.parent && (ts.isParenthesizedExpression(current.parent)
    || ts.isConditionalExpression(current.parent) && current.parent.condition !== current)) current = current.parent;
  if (!current.parent || !ts.isJsxExpression(current.parent)) return false;
  const context = current.parent.parent;
  if (!ts.isJsxAttribute(context)) return true;
  const tag = context.parent.parent.tagName?.getText(tree) ?? "";
  return /^[a-z][a-z0-9]*$/.test(tag) && policy.copy_attributes.includes(context.name.getText(tree));
}
export function compareTsx(path, before, after, policy, sources = {}, details = { breakpoints: new Set(), logic_categories: new Set() }) {
  const oldTree = parse(path, before), newTree = parse(path, after);
  const classes = new Set();
  function compare(oldNode, newNode) {
    if (oldNode.kind === newNode.kind && oldNode.getText(oldTree) === newNode.getText(newTree)) return;
    for (const category of [...logicCategories(oldNode, oldTree), ...logicCategories(newNode, newTree)]) details.logic_categories.add(category);
    reject(oldNode.kind === newNode.kind, "DOM_OR_LOGIC_STRUCTURE_CHANGED");
    if (ts.isJsxAttribute(oldNode) && ts.isJsxAttribute(newNode) && oldNode.name.getText(oldTree) === newNode.name.getText(newTree)) {
      const name = oldNode.name.getText(oldTree);
      if (name === "className") {
        requireValue(oldNode.initializer && newNode.initializer && ts.isStringLiteral(oldNode.initializer) && ts.isStringLiteral(newNode.initializer), "CLASS_EXPRESSION_CHANGED");
        classChange(oldNode.initializer.text, newNode.initializer.text, policy, sources, details);
        classes.add("literal_className"); return;
      }
      if (name === "style") {
        inlineStyle(oldNode.initializer, policy); inlineStyle(newNode.initializer, policy);
        classes.add("literal_inline_style"); return;
      }
      const tag = oldNode.parent.parent.tagName?.getText(oldTree) ?? "";
      if (policy.copy_attributes.includes(name) && /^[a-z][a-z0-9]*$/.test(tag)
          && oldNode.initializer && newNode.initializer && ts.isStringLiteral(oldNode.initializer) && ts.isStringLiteral(newNode.initializer)) {
        classes.add("text_only_copy"); return;
      }
    }
    if (ts.isJsxText(oldNode) && ts.isJsxText(newNode)) {
      reject(Boolean(oldNode.text.trim()) && Boolean(newNode.text.trim()), "TEXT_NODE_ADD_REMOVE");
      classes.add("text_only_copy"); return;
    }
    if (ts.isStringLiteral(oldNode) && ts.isStringLiteral(newNode)
        && displayLiteral(oldNode, oldTree, policy) && displayLiteral(newNode, newTree, policy)) {
      classes.add("text_only_copy"); return;
    }
    if (ts.isJsxExpression(oldNode) && ts.isJsxExpression(newNode) && !ts.isJsxAttribute(oldNode.parent)
        && oldNode.expression && newNode.expression && ts.isStringLiteral(oldNode.expression) && ts.isStringLiteral(newNode.expression)) {
      classes.add("text_only_copy"); return;
    }
    const oldChildren = oldNode.getChildren(oldTree), newChildren = newNode.getChildren(newTree);
    reject(oldChildren.length > 0 && oldChildren.length === newChildren.length, "LOGIC_OR_DOM_CHANGED");
    const oldOrder = oldChildren.map((child) => child.getText(oldTree));
    const newOrder = newChildren.map((child) => child.getText(newTree));
    reject(canonical(oldOrder) === canonical(newOrder) || canonical([...oldOrder].sort()) !== canonical([...newOrder].sort()), "DOM_REORDERED");
    oldChildren.forEach((child, index) => compare(child, newChildren[index]));
  }
  compare(oldTree, newTree);
  requireValue(classes.size > 0, "NO_PROVEN_PRESENTATION_CHANGE");
  details.logic_categories.clear(); // All changes were proven presentation leaves.
  return [...classes];
}
export function compareCss(path, before, after, policy, sources = {}, details = { breakpoints: new Set() }) {
  reject(!policy.css.normal_paths.includes(path), "CSS_FILE_INITIAL_NORMAL");
  let changed = false;
  function compare(oldNode, newNode) {
    if (oldNode.toString() === newNode.toString()) return;
    reject(oldNode.type === newNode.type, "CSS_STRUCTURE_CHANGED");
    if (oldNode.type === "decl") {
      reject(oldNode.prop === newNode.prop && oldNode.important === newNode.important && !newNode.important, "CSS_PROPERTY_STRUCTURE_CHANGED");
      safeCssContext(newNode, policy, details);
      cssValue(oldNode.prop, oldNode.value, policy); cssValue(newNode.prop, newNode.value, policy);
      if (oldNode.value !== newNode.value) changed = true;
      const tokens = newNode.parent.selector?.match(/\.[\w-]+/g)?.map((token) => token.slice(1)) ?? [];
      checkSelectorUsage(tokens, sources);
      return;
    }
    if (oldNode.type === "rule") reject(oldNode.selector === newNode.selector, "CSS_SELECTOR_CHANGED");
    if (oldNode.type === "atrule") reject(oldNode.name === newNode.name && oldNode.params === newNode.params, "CSS_MEDIA_OR_AT_RULE_CHANGED");
    const left = oldNode.nodes?.filter((n) => n.type !== "comment") ?? [], right = newNode.nodes?.filter((n) => n.type !== "comment") ?? [];
    reject(left.length === right.length, "CSS_STRUCTURE_CHANGED");
    left.forEach((node, i) => compare(node, right[i]));
  }
  compare(cssTree(before), cssTree(after));
  requireValue(changed, "NO_PROVEN_PRESENTATION_CHANGE");
  return ["scoped_css"];
}
function importTargets(path, content, files, moduleCache) {
  if (!/\.tsx?$/.test(path)) return [];
  const tree = parse(path, content), targets = [];
  function resolveImport(specifier) {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
      const resolved = ts.resolveModuleName(specifier, resolve(policyDirectory, "../../", path),
        { moduleResolution: ts.ModuleResolutionKind.Bundler }, ts.sys, moduleCache).resolvedModule;
      requireValue(resolved, "UNRESOLVED_PACKAGE_IMPORT");
      return;
    }
    const base = specifier.startsWith("@/") ? `src/${specifier.slice(2)}` : posix.normalize(posix.join(posix.dirname(path), specifier));
    const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((entry) => files.has(entry));
    requireValue(target, "UNRESOLVED_SHARED_IMPORT"); targets.push(target);
  }
  function visit(node) {
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(tree) === "require")) {
      requireValue(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]), "DYNAMIC_IMPORT_UNKNOWN"); resolveImport(node.arguments[0].text);
    }
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) resolveImport(node.moduleSpecifier.text);
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === "src" && node.initializer && ts.isStringLiteral(node.initializer) && node.initializer.text.startsWith("/")) {
      const target = `public${node.initializer.text}`;
      if (files.has(target)) targets.push(target);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); return targets;
}
export function impactFor(paths, sources, impact = defaultImpact, policy = defaultPolicy, inventory = Object.keys(sources)) {
  requireValue(Array.isArray(policy.acceptance_viewports), "ACCEPTANCE_POLICY_INVALID");
  const files = new Set(inventory);
  const moduleCache = ts.createModuleResolutionCache(resolve(policyDirectory, "../.."), (path) => path,
    { moduleResolution: ts.ModuleResolutionKind.Bundler });
  const imports = new Map(Object.entries(sources).map(([path, source]) => [path, importTargets(path, source, files, moduleCache)]));
  // CSS imports and Next's filesystem layout relation are not TS imports.
  for (const [path, source] of Object.entries(sources)) {
    if (!path.endsWith(".css")) continue;
    const targets = [];
    cssTree(source).walkAtRules("import", (rule) => {
      const match = rule.params.match(/^["']([^"']+)["']$/);
      requireValue(match, "CSS_IMPORT_UNRESOLVED");
      if (match[1].startsWith(".")) {
        const target = posix.normalize(posix.join(posix.dirname(path), match[1]));
        requireValue(files.has(target), "CSS_IMPORT_UNRESOLVED"); targets.push(target);
      }
    });
    imports.set(path, targets);
  }
  for (const dependency of impact.manual_dependencies) for (const path of files) {
    if (path.startsWith(dependency.consumer_prefix) && path.endsWith(dependency.consumer_suffix)) imports.set(path, [...(imports.get(path) ?? []), dependency.dependency]);
  }
  const propagate = (initial) => {
    const result = new Set(initial);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const [path, targets] of imports) if (!result.has(path) && targets.some((target) => result.has(target))) { result.add(path); expanded = true; }
    }
    return result;
  };
  const affected = propagate(paths);
  const areas = impact.areas.filter((area) => [...affected].some((path) => area.paths.some((prefix) => path.startsWith(prefix))));
  requireValue(paths.every((path) => [...propagate([path])].some((entry) =>
    areas.some((area) => area.paths.some((prefix) => entry.startsWith(prefix))))), "UNMAPPED_IMPACT");
  const routes = [...affected].filter((path) => /^src\/app\/(?:.*\/)?page\.tsx$/.test(path))
    .map((path) => `/${path.slice(8).replace(/(?:^|\/)page\.tsx$/, "").replace(/\([^/]+\)\//g, "")}`.replace(/\/$/, "") || "/");
  return { affected_modules: areas.map((area) => area.area).sort(), affected_components: [...affected].sort(),
    affected_routes: [...new Set(routes)].sort(), affected_states: [],
    critical_components: [...affected].filter((path) => impact.critical_paths.some((prefix) => path.startsWith(prefix))).sort() };
}
async function compareRaster(path, before, after, policy) {
  const format = policy.asset_extensions[posix.extname(path).toLowerCase()];
  reject(Boolean(format), "ASSET_FORMAT_INITIAL_NORMAL");
  for (const bytes of [before, after]) {
    const instance = requireNext("sharp")(bytes, { animated: true });
    const metadata = await instance.metadata();
    reject(metadata.format === format, "ASSET_FORMAT_MISMATCH");
    await instance.raw().toBuffer();
  }
  return ["static_raster"];
}
export async function classifyDiff(input, policy = defaultPolicy, impact = defaultImpact) {
  const fallback = policy.fallback_behavior;
  const gateChange = input.changes?.some((change) => matchesAny(change.path ?? "", policy.authority_path_patterns));
  const lane = gateChange ? fallback.authority_logic_change : input.platform_impact === "NONE" ? fallback.storefront : fallback.platform_unknown;
  const record = {
    schema_version: "1.0", repository: "ideal-sol/luxe-pack-storefront",
    base_sha: input.base_sha ?? null, head_sha: input.head_sha ?? null, tree_sha: input.tree_sha ?? null,
    policy_version: policy.policy_version, policy_digest: seal(policy).record_digest,
    impact_map_version: impact.map_version, impact_map_digest: seal(impact).record_digest,
    policy_approval: policy.policy_approval, classification_state: "INDETERMINATE",
    candidate_lane: lane, fallback_lane: lane, classification_reason: "EVIDENCE_PENDING",
    evidence: [], unknown_reasons: [], change_classes: [], affected_modules: [], affected_routes: [], affected_states: [],
    production_impact: "NONE", blocking_authority: false, ci_skip: false,
  };
  const details = { breakpoints: new Set(), logic_categories: new Set() };
  try {
    requireValue([input.base_sha, input.head_sha, input.tree_sha].every((sha) => fullSha.test(sha)), "BASELINE_IDENTITY_INVALID", "INDETERMINATE");
    requireValue(input.complete_diff === true && Array.isArray(input.changes) && input.changes.length > 0, "INCOMPLETE_DIFF", "INDETERMINATE");
    requireValue(input.baseline_matches === true, "BASELINE_MISMATCH", "INDETERMINATE");
    reject(!gateChange, "GATE_AUTHORITY_CHANGE_STRICT");
    requireValue(input.platform_impact === "NONE", "PLATFORM_IMPACT_UNKNOWN", "INDETERMINATE");
    requireValue(policy.allowed_change_classes.every((entry) => changeClasses.has(entry)), "UNKNOWN_MACHINE_POLICY_CLASS");
    const classes = new Set(), paths = [];
    for (const change of input.changes) {
      const path = change.path;
      requireValue(typeof path === "string" && !path.includes("..") && !path.startsWith("/"), "INVALID_PATH");
      reject(change.status === "M" && change.old_mode === "100644" && change.new_mode === "100644", "ADD_REMOVE_RENAME_MODE_CHANGE");
      reject(!matchesAny(path, policy.normal_path_patterns), "CONFIG_OR_TOOLING_INITIAL_NORMAL");
      paths.push(path);
      let found;
      if (/\.tsx?$/.test(path) && path.startsWith("src/")) {
        // Resolve styles against both trees. New styles must not hide unsafe old dependencies.
        found = compareTsx(path, change.before.toString("utf8"), change.after.toString("utf8"), policy, input.base_sources, details);
        compareTsx(path, change.before.toString("utf8"), change.after.toString("utf8"), policy, input.head_sources, details);
      } else if (path.endsWith(".css") && path.startsWith("src/")) {
        found = compareCss(path, change.before.toString("utf8"), change.after.toString("utf8"), policy, { ...input.base_sources, ...input.head_sources }, details);
      } else if (policy.asset_extensions[posix.extname(path).toLowerCase()]) {
        reject(input.changes.every((entry) => policy.asset_extensions[posix.extname(entry.path).toLowerCase()]), "ASSET_REFERENCE_OR_CODE_CHANGE");
        found = await compareRaster(path, change.before, change.after, policy);
      } else { reject(false, "SOURCE_TYPE_INITIAL_NORMAL"); }
      reject(found.every((entry) => policy.allowed_change_classes.includes(entry)), "CHANGE_CLASS_NOT_ALLOWED");
      found.forEach((entry) => classes.add(entry));
      record.evidence.push({ path, classes: found, before_digest: createHash("sha256").update(change.before).digest("hex"), after_digest: createHash("sha256").update(change.after).digest("hex") });
    }
    const oldImpact = impactFor(paths, input.base_sources, impact, policy, input.base_inventory);
    const newImpact = impactFor(paths, input.head_sources, impact, policy, input.head_inventory);
    for (const key of Object.keys(oldImpact)) record[key] = [...new Set([...oldImpact[key], ...newImpact[key]])].sort();
    record.change_classes = [...classes].sort();
    // Per-file propagation avoids an area × all-changes Cartesian acceptance plan.
    const focused = record.evidence.flatMap((entry) => {
      const areas = new Set([...impactFor([entry.path], input.base_sources, impact, policy, input.base_inventory).affected_modules,
        ...impactFor([entry.path], input.head_sources, impact, policy, input.head_inventory).affected_modules]);
      return [...areas].map((area) => ({ impact_area: area, change_classes: entry.classes, changed_path: entry.path }));
    });
    record.browser_acceptance_plan = seal({ schema_version: "1.0", affected_routes: record.affected_routes,
      affected_components: record.affected_components, affected_states: [], focused_acceptance: focused,
      required_viewport_classes: policy.acceptance_viewports, affected_breakpoints: [...details.breakpoints].sort(),
      acceptance_reason: "Inspect the changed presentation in its affected importer contexts; no all-state sweep",
      status: "HUMAN_BROWSER_ACCEPTANCE_PENDING" });
    record.classification_state = "ELIGIBLE";
    record.classification_reason = "PRESENTATION_ONLY_PROVEN_OPERATIONAL_GATE_PENDING";
    // This shadow tool never emits a usable Minor lane. Protected-main operational
    // approval and the remaining Formal Gate evidence are a separate future change.
    if (record.policy_approval !== "HUMAN_APPROVED") record.unknown_reasons.push("MACHINE_POLICY_APPROVAL_PENDING");
  } catch (error) {
    record.classification_state = error.state ?? "UNCLASSIFIED";
    record.classification_reason = /^[A-Z][A-Z_]+$/.test(error.message ?? "") ? error.message : "CLASSIFIER_ERROR";
    record.unknown_reasons.push(record.classification_reason);
    record.logic_categories = [...details.logic_categories].sort();
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
  const inventory = (sha) => git(root, "ls-tree", "-r", "--name-only", "-z", sha, "src", "public").toString().split("\0").filter(Boolean);
  const sources = (sha, paths) => Object.fromEntries(paths.filter((path) => /\.(?:tsx?|css)$/.test(path) && !path.startsWith("src/test/"))
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
      result = await classifyDiff(applyHandoff(input, handoff), defaultPolicy);
    } else {
      result = await classifyDiff(input);
    }
  } catch {
    result = await classifyDiff({ base_sha: base, head_sha: head, platform_impact: "UNKNOWN" });
  }
  writeFileSync(output, `${canonical(result)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ candidate_lane: result.candidate_lane, production_impact: "NONE" }));
}

import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyHandoff, classifyDiff, compareCss, compareTsx, defaultPolicy, defaultImpact, impactFor, seal } from "../../scripts/readiness/classifier.mjs";
import { replayRequiredChecks, verifyApprovedContract } from "../../scripts/readiness/adapters.mjs";

const normal = "Normal Storefront Release", full = "Full Platform + Storefront Release", strict = "NORMAL_STRICT_CI";
const path = "src/components/common/page-title.tsx";
const before = 'export function Title() { return <h1 className="small">Hello</h1>; }';
const styles = '.small { padding: 8px; } .large { padding: 16px; }';
const repositoryRoot = process.cwd();
// This explicit tracked-source inventory is shipped in git archive. Validate
// the entire src tree against it, so missing or extra local files cannot supply
// false grounding, and do not follow links outside the packaged source tree.
function packagedSourceInventory() {
  const packaged = JSON.parse(readFileSync(resolve(repositoryRoot, "scripts/readiness/source-inventory.v1.json"), "utf8"));
  function walk(directory) {
    return readdirSync(resolve(repositoryRoot, directory), { withFileTypes: true }).flatMap((entry) => {
      const file = `${directory}/${entry.name}`;
      expect(entry.isSymbolicLink(), file).toBe(false);
      if (entry.isDirectory()) return walk(file);
      expect(entry.isFile(), file).toBe(true);
      return [file];
    });
  }
  expect(walk("src").sort()).toEqual(packaged);
  return packaged;
}
function input(file = path, previous = before, next = before.replace("Hello", "Welcome")) {
  const sources = { [path]: before, "src/styles/globals.css": styles,
    "src/app/contact/page.tsx": 'import { Title } from "../../components/common/page-title"; export default Title;' };
  return {
    base_sha: "a".repeat(40), head_sha: "b".repeat(40), tree_sha: "c".repeat(40),
    complete_diff: true, baseline_matches: true, platform_impact: "NONE",
    changes: [{ path: file, status: "M", old_mode: "100644", new_mode: "100644", before: Buffer.from(previous), after: Buffer.from(next) }],
    base_sources: { ...sources, [file]: previous.toString() }, head_sources: { ...sources, [file]: next.toString() },
  };
}
async function state(data, expected, policy = defaultPolicy) {
  const record = await classifyDiff(data, policy);
  expect(record.classification_state, JSON.stringify(record)).toBe(expected);
  expect(record.production_impact).toBe("NONE");
  expect(record.blocking_authority).toBe(false);
  expect(record.ci_skip).toBe(false);
  expect(record.record_digest).toBe(seal(record).record_digest);
  return record;
}
const css = (previous, next, file = "src/styles/globals.css") => input(file, previous, next);
const declaration = (name, left, right) => css(`.title { ${name}: ${left}; }`, `.title { ${name}: ${right}; }`);

describe("four-state shadow machine policy alignment", () => {
  it.each(["h1", "p", "button", "label", "strong", "span"])("literal %s copy is eligible", async (tag) => {
    const old = `export const View = () => <${tag}>Before</${tag}>;`;
    const record = await state(input(path, old, old.replace("Before", "After")), "ELIGIBLE");
    expect(record.change_classes).toEqual(["text_only_copy"]);
    expect(record.candidate_lane).toBe(normal);
    expect(record.policy_version).toBe("1.1.2-operational-approved");
    expect(record.policy_approval).toBe("HUMAN_APPROVED");
    expect(record.unknown_reasons).not.toContain("MACHINE_POLICY_APPROVAL_PENDING");
  });
  it.each(["payment/card-save-confirmation", "auth/auth-problem", "draw/gacha-draw-panel"])("critical %s text is eligible", async (component) => {
    const old = 'export const View = () => <div role="alert">Payment failed</div>;';
    const record = await state(input(`src/components/${component}.tsx`, old, old.replace("Payment failed", "Please retry")), "ELIGIBLE");
    expect(record.critical_components).toContain(`src/components/${component}.tsx`);
  });
  it.each(["placeholder", "aria-label", "title", "alt"])("literal native %s is copy", async (attribute) => {
    const old = `export const View = () => <input ${attribute}="Before" />;`;
    await state(input(path, old, old.replace("Before", "After")), "ELIGIBLE");
  });
  it("literal JSX expression is copy", async () => {
    const old = 'export const View = () => <div>{"Before"}</div>;';
    await state(input(path, old, old.replace("Before", "After")), "ELIGIBLE");
  });
  it.each([
    ['onClick={() => send(1)}', 'onClick={() => send(2)}', "event_handler"],
    ['onSubmit={submit}', 'onSubmit={save}', "event_handler"],
    ['onClick={() => setState(1)}', 'onClick={() => setState(2)}', "state_mutation"],
    ['onClick={() => router.push("/a")}', 'onClick={() => router.push("/b")}', "navigation"],
    ['onClick={() => fetch("/a")}', 'onClick={() => fetch("/b")}', "api"],
    ['onClick={() => client.createDraw(1)}', 'onClick={() => client.createDraw(2)}', "mutation_write"],
    ['onClick={() => refreshSession(1)}', 'onClick={() => refreshSession(2)}', "authentication_session"],
    ['onClick={() => confirmPayment(1)}', 'onClick={() => confirmPayment(2)}', "payment_security"],
  ])("rejects mixed text and AST behavior %s", async (left, right, category) => {
    const old = `export const View = () => <button ${left}>Hello</button>;`;
    const record = await state(input(path, old, old.replace(left, right).replace("Hello", "Welcome")), "NOT_ELIGIBLE");
    expect(record.logic_categories).toContain(category);
  });
  it.each([
    ['const x = useState(1);', 'const x = useState(2);', "hooks"],
    ['useEffect(() => send(1), []);', 'useEffect(() => send(2), []);', "effects"],
    ['const payload = { amount: 1 };', 'const payload = { amount: 2 };', "payload"],
    ['if (ready) send();', 'if (!ready) send();', "conditional_control_flow"],
    ['let x = 0; x = 1;', 'let x = 0; x = 2;', "state_mutation"],
  ])("detects changed AST category %s", async (left, right, category) => {
    const old = before.replace("return", `${left} return`);
    const record = await state(input(path, old, old.replace(left, right).replace("Hello", "Welcome")), "NOT_ELIGIBLE");
    expect(record.logic_categories).toContain(category);
  });
  it.each([
    ['<h1>Hello</h1>', '<h2>Welcome</h2>'],
    ['<div><p>A</p><p>B</p></div>', '<div><p>B</p><p>A</p></div>'],
    ['<div><p>A</p></div>', '<div><p>A</p><span>B</span></div>'],
    ['<div><p>A</p><span>B</span></div>', '<div><p>A</p></div>'],
    ['<div><p>A</p><span>B</span></div>', '<div><span>B</span><p>A</p></div>'],
    ['<h1>Hello</h1>', '<div><h1>Hello</h1></div>'],
    ['<h1>Hello</h1>', 'enabled && <h1>Hello</h1>'],
    ['<input value="a" />', '<input value="b" />'],
    ['<a href="/a">A</a>', '<a href="/b">A</a>'],
    ['<img src="/a.png" />', '<img src="/b.png" />'],
    ['<Widget title="a" />', '<Widget title="b" />'],
  ])("DOM/logic/reference changes stay normal: %s", async (left, right) => {
    await state(input(path, `export const V = () => ${left};`, `export const V = () => ${right};`), "NOT_ELIGIBLE");
  });
  it("parser failure is UNCLASSIFIED", async () => { await state(input(path, before, "export function {"), "UNCLASSIFIED"); });
});

describe("CSS property policy and parser", () => {
  it.each([
    ["color", "#fff", "#000"], ["background-color", "red", "blue"], ["border-color", "#fff", "rgba(0, 0, 0, .5)"],
    ["margin", "16px", "24px"], ["padding", "0", "128px 8rem 8em 0"], ["gap", "0", "8rem"],
    ["font-size", "14px", "16px"], ["font-size", "10px", "64px"], ["font-size", ".625rem", "4em"],
    ["line-height", ".8", "2.5"], ["line-height", ".75em", "6rem"],
    ["letter-spacing", "-.1em", ".2em"], ["letter-spacing", "-2px", "4px"],
    ["border-radius", "0", "999px"], ["border-radius", "0", "50rem 50em"],
    ["font-weight", "400", "750"],
  ])("eligible %s: %s → %s", async (property, left, right) => { await state(declaration(property, left, right), "ELIGIBLE"); });
  it.each(["margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left", "row-gap", "column-gap"])("binds %s bounds", async (property) => {
    await state(declaration(property, "0", "128px"), "ELIGIBLE");
    await state(declaration(property, "0", "129px"), "NOT_ELIGIBLE");
  });
  it.each([
    ["margin", "129px"], ["margin", "-1px"], ["padding", "8.1rem"], ["gap", "9em"],
    ["font-size", "65px"], ["font-size", "9px"], ["font-size", "4.1rem"],
    ["line-height", "2.6"], ["line-height", ".7em"], ["letter-spacing", "-.11em"],
    ["letter-spacing", "4.1px"], ["border-radius", "1000px"], ["border-radius", "51rem"],
    ["font-weight", "1001"],
  ])("rejects %s outside bound: %s", async (property, value) => {
    const initial = { "font-size": "16px", "line-height": "1", "font-weight": "400" }[property] ?? "0";
    await state(declaration(property, initial, value), "NOT_ELIGIBLE");
  });
  it.each(["calc(1rem + 1px)", "var(--space)", "1vw", "banana"])("unresolved CSS value %s", async (value) => { await state(declaration("margin", "0", value), "UNCLASSIFIED"); });
  it.each(["display", "visibility", "pointer-events", "opacity", "overflow", "overflow-x", "overflow-y", "clip", "clip-path", "position", "top", "right", "bottom", "left", "inset", "z-index", "transform", "order", "animation", "transition", "width", "height", "min-width", "max-width", "min-height", "max-height", "grid-template-columns", "grid-template-rows", "flex-direction", "flex-wrap", "justify-content", "align-items", "font-family"])("%s is Initial Normal", async (property) => {
    await state(declaration(property, "initial", "inherit"), "NOT_ELIGIBLE");
  });
  it.each([":root", "html", "body", "*", ".title:focus", ".title:focus-visible", ".title[disabled]", ".error", ".confirmation", ".operational"])("selector %s is Initial Normal", async (selector) => {
    await state(css(`${selector} { color: red; }`, `${selector} { color: blue; }`), "NOT_ELIGIBLE");
  });
  it("global files accept safe selector changes alongside unchanged unsafe rules", async () => {
    const old = '@import "tailwindcss"; :root { --ink: #fff; } body { display: block; } .title { margin: 16px; }';
    for (const file of ["src/styles/globals.css", "src/styles/theme-oripoke.css"]) await state(css(old, old.replace("16px", "24px"), file), "ELIGIBLE");
  });
  it("font file is Initial Normal", async () => { await state(css('.a { color: red; }', '.a { color: blue; }', "src/styles/font-noto-sans-jp.css"), "NOT_ELIGIBLE"); });
  it("existing media block produces focused breakpoint acceptance", async () => {
    const old = '@media (min-width: 768px) { .title { margin: 16px; } }';
    const record = await state(css(old, old.replace("16px", "24px")), "ELIGIBLE");
    expect(record.browser_acceptance_plan.affected_breakpoints).toEqual(["(min-width: 768px)"]);
    expect(record.browser_acceptance_plan.affected_states).toEqual([]);
    expect(record.browser_acceptance_plan.status).toBe("HUMAN_BROWSER_ACCEPTANCE_PENDING");
  });
  it.each([
    ['@media (min-width: 768px)', '@media (min-width: 800px)'],
    ['@media screen', '@media print'],
    ['@media (prefers-reduced-motion: reduce)', '@media (prefers-reduced-motion: reduce)'],
    ['@font-face', '@font-face'],
  ])("media or special rule is normal: %s", async (left, right) => {
    await state(css(`${left} { .title { margin: 16px; } }`, `${right} { .title { margin: 24px; } }`), "NOT_ELIGIBLE");
  });
  it.each([
    ['.title { color: red; }', '.title { color: blue; } @media screen { .title { color: red; } }'],
    ['.title { color: red; } @media screen { .title { color: red; } }', '.title { color: blue; }'],
    ['.title { color: red; }', '.title { color: red; margin: 0; }'],
  ])("CSS structure is normal", async (left, right) => { await state(css(left, right), "NOT_ELIGIBLE"); });
  it("malformed CSS is UNCLASSIFIED", async () => { await state(css('.title { color: red; }', '.title { color: blue;'), "UNCLASSIFIED"); });
  it("critical auth CSS is eligible", async () => {
    const data = css('.title { color: red; }', '.title { color: blue; }', "src/components/auth/view.module.css");
    data.base_sources["src/components/auth/auth-problem.tsx"] = data.head_sources["src/components/auth/auth-problem.tsx"] = 'import "./view.module.css";';
    await state(data, "ELIGIBLE");
  });
});

describe("static classes and inline styles", () => {
  it("resolves all changed literal classes to safe styles", async () => { await state(input(path, before, before.replace("small", "large")), "ELIGIBLE"); });
  it.each([
    ['className={enabled ? "small" : "large"}', 'className={enabled ? "large" : "small"}'],
    ['className={helper("small")}', 'className={helper("large")}'],
    ['style={{ margin: space }}', 'style={{ margin: 4 }}'],
    ['style={{ ...base, margin: 4 }}', 'style={{ ...base, margin: 8 }}'],
    ['style={{ margin: value() }}', 'style={{ margin: other() }}'],
  ])("unresolved expression %s", async (left, right) => {
    await state(input(path, `export const V = () => <p ${left}>A</p>;`, `export const V = () => <p ${right}>A</p>;`), "UNCLASSIFIED");
  });
  it("dangerous resolved class is NOT_ELIGIBLE", async () => {
    const data = input(path, before, before.replace("small", "large"));
    data.base_sources["src/styles/globals.css"] = data.head_sources["src/styles/globals.css"] = '.small { padding: 8px; } .large { position: fixed; }';
    await state(data, "NOT_ELIGIBLE");
  });
  it("unresolved class is UNCLASSIFIED", async () => { await state(input(path, before, before.replace("small", "unknown")), "UNCLASSIFIED"); });
  it("unresolved CSS dependency is UNCLASSIFIED", async () => {
    const data = input(path, before, before.replace("small", "large"));
    data.head_sources["src/styles/globals.css"] = '@import "external.css"; ' + styles;
    await state(data, "UNCLASSIFIED");
  });
  it.each([
    ['style={{ color: "red", marginTop: "16px" }}', 'style={{ color: "blue", marginTop: "24px" }}'],
    ['style={{ lineHeight: 1, fontWeight: 400 }}', 'style={{ lineHeight: 2, fontWeight: 700 }}'],
    ['style={{ letterSpacing: -1 }}', 'style={{ letterSpacing: 2 }}'],
  ])("safe literal inline style", async (left, right) => {
    await state(input(path, `export const V = () => <p ${left}>A</p>;`, `export const V = () => <p ${right}>A</p>;`), "ELIGIBLE");
  });
  it("dangerous inline style is Normal", async () => {
    const old = 'export const V = () => <p style={{ opacity: 1 }}>A</p>;';
    await state(input(path, old, old.replace("opacity: 1", "opacity: 0")), "NOT_ELIGIBLE");
  });
  it("AST selector calls prevent behavioral class changes", () => {
    expect(() => compareTsx(path, before, before.replace("small", "large"), defaultPolicy, { "selector.ts": 'document.querySelector(".small")', "style.css": styles })).toThrow("JS_SELECTOR_REFERENCED_CLASS");
    expect(() => compareTsx(path, before, before.replace("small", "large"), defaultPolicy, { "selector.ts": 'document.querySelector(selector)', "style.css": styles })).toThrow("DYNAMIC_SELECTOR_UNKNOWN");
  });
});

describe("source assets and impact graph", () => {
  it.each(["png", "jpg", "jpeg", "webp"])("same-path %s byte replacement is eligible", async (extension) => {
    const sharp = createRequire(import.meta.resolve("next/package.json"))("sharp");
    const image = async (color) => sharp({ create: { width: 8, height: 8, channels: 3, background: color } }).toFormat(extension === "jpg" ? "jpeg" : extension).toBuffer();
    const file = `src/components/catalog/source.${extension}`;
    const data = input(file, await image("red"), await image("blue"));
    delete data.base_sources[file]; delete data.head_sources[file];
    const record = await state(data, "ELIGIBLE");
    expect(record.change_classes).toEqual(["static_raster"]);
  });
  it("SVG is normal", async () => { await state(input("src/components/catalog/source.svg", "<svg/>", "<svg> </svg>"), "NOT_ELIGIBLE"); });
  it("shared import graph expands only actual areas", () => {
    const sources = { [path]: before,
      "src/components/contact/contact-form.tsx": 'import { Title } from "../common/page-title"; export const Form = () => <Title />;',
      "src/app/contact/page.tsx": 'import { Form } from "../../components/contact/contact-form"; export default Form;' };
    const result = impactFor([path], sources);
    expect(result.affected_modules).toEqual(["Contact / Follow-up Inquiry", "Shared Providers / Global Styles"]);
    expect(result.affected_routes).toEqual(["/contact"]);
    expect(result.affected_components).toContain("src/app/contact/page.tsx");
  });
  it("Next filesystem layout propagates global styles to pages", () => {
    const sources = { "src/styles/globals.css": styles, "src/app/layout.tsx": 'import "../styles/globals.css";', "src/app/contact/page.tsx": "export default 1", "src/app/page.tsx": "export default 2" };
    expect(impactFor(["src/styles/globals.css"], sources).affected_routes).toEqual(["/", "/contact"]);
  });
  it("unresolved local import is UNCLASSIFIED with Normal fallback", async () => {
    const data = input(); data.head_sources[path] += ' import missing from "./missing";';
    const record = await state(data, "UNCLASSIFIED"); expect(record.fallback_lane).toBe(normal);
  });
  it("dynamic import is UNCLASSIFIED", async () => {
    const data = input(); data.head_sources[path] += ' import(variable);'; await state(data, "UNCLASSIFIED");
  });
  it("21 areas and protected prefixes are grounded in tracked source", () => {
    const files = packagedSourceInventory();
    expect(defaultImpact.areas).toHaveLength(21);
    for (const prefix of [...defaultImpact.critical_paths, ...defaultImpact.areas.flatMap((area) => area.paths)]) expect(files.some((file) => file.startsWith(prefix)), prefix).toBe(true);
    expect(defaultImpact.manual_dependencies).toHaveLength(1);
  });
  it("real source import graph resolves without external runtime access", () => {
    const files = packagedSourceInventory();
    const sources = Object.fromEntries(files.filter((file) => /\.(tsx?|css)$/.test(file) && !file.startsWith("src/test/")).map((file) => [file, readFileSync(resolve(repositoryRoot, file), "utf8")]));
    expect(impactFor(["src/styles/globals.css"], sources, defaultImpact, defaultPolicy, files).affected_routes).toContain("/points");
  }, 30_000);
});

describe("fallback, authority and policy binding", () => {
  it.each(["complete_diff", "baseline_matches"])("missing %s evidence is INDETERMINATE", async (key) => {
    const data = input(); data[key] = false;
    const record = await state(data, "INDETERMINATE"); expect(record.fallback_lane).toBe(normal);
  });
  it.each(["UNKNOWN", "PRESENT", undefined])("Platform %s falls back Full", async (impact) => {
    const data = input(); data.platform_impact = impact;
    const record = await state(data, "INDETERMINATE"); expect(record.candidate_lane).toBe(full); expect(record.fallback_lane).toBe(full);
  });
  it.each(["scripts/readiness/minor-policy.v1.json", "scripts/readiness/classifier.mjs", "scripts/readiness/impact-map.v1.json", "scripts/readiness/adapters.mjs", ".github/workflows/readiness-shadow.yml", "src/test/readiness-classifier.test.mjs"])("gate change is Strict even with candidate policy: %s", async (file) => {
    const data = input(file); data.platform_impact = "UNKNOWN";
    const record = await state(data, "NOT_ELIGIBLE"); expect(record.candidate_lane).toBe(strict); expect(record.fallback_lane).toBe(strict);
  });
  it.each(["package.json", "pnpm-lock.yaml", "next.config.ts", ".env.example", "src/proxy.ts", "src/lib/platform/runtime-configuration.ts"])("config source is Normal: %s", async (file) => {
    const record = await state(input(file), "NOT_ELIGIBLE"); expect(record.candidate_lane).toBe(normal);
  });
  it("CSS JSON bounds and property removal change behavior", async () => {
    const policy = structuredClone(defaultPolicy); policy.css.properties.margin.units.px[1] = 20;
    await state(declaration("margin", "16px", "24px"), "NOT_ELIGIBLE", policy);
    delete policy.css.properties.color;
    await state(declaration("color", "red", "blue"), "NOT_ELIGIBLE", policy);
  });
  it("change class allowlist and copy attributes bind behavior", async () => {
    const policy = structuredClone(defaultPolicy); policy.allowed_change_classes = policy.allowed_change_classes.filter((entry) => entry !== "text_only_copy");
    await state(input(), "NOT_ELIGIBLE", policy);
    const copy = structuredClone(defaultPolicy); copy.copy_attributes = [];
    const old = 'export const V = () => <input placeholder="A" />;';
    await state(input(path, old, old.replace('"A"', '"B"')), "NOT_ELIGIBLE", copy);
  });
  it("fallback values and viewport policy bind output", async () => {
    const policy = structuredClone(defaultPolicy); policy.fallback_behavior.storefront = "fixture-normal"; policy.acceptance_viewports = ["fixture-viewport"];
    const result = await state(input(), "ELIGIBLE", policy);
    expect(result.candidate_lane).toBe("fixture-normal"); expect(result.browser_acceptance_plan.required_viewport_classes).toEqual(["fixture-viewport"]);

  });
  it("does not accept unknown machine classes", async () => {
    const policy = structuredClone(defaultPolicy); policy.allowed_change_classes.push("handler"); await state(input(), "UNCLASSIFIED", policy);
  });
  it("binds policy and map identity deterministically", async () => {
    const record = await classifyDiff(input());
    expect(record.policy_digest).toBe(seal(defaultPolicy).record_digest); expect(record.impact_map_digest).toBe(seal(defaultImpact).record_digest);
    expect(seal({ text: "表示", version: "1.0" })).toEqual(seal({ version: "1.0", text: "表示" }));
  });
  it("handoff requires exact identities and Human evidence, cannot provide policy", () => {
    const data = input();
    const handoff = seal({ schema_version: "1.0", repository: "ideal-sol/luxe-pack-storefront", base_sha: data.base_sha, head_sha: data.head_sha, tree_sha: data.tree_sha,
      platform_impact: "NONE", evidence_reference: "fixture:human-confirmed", confirmed_by_role: "human_operator" });
    expect(applyHandoff(data, handoff).platform_impact).toBe("NONE");
    expect(() => applyHandoff({ ...data, head_sha: "d".repeat(40) }, handoff)).toThrow();
    expect(() => applyHandoff(data, { ...handoff, evidence_reference: "" })).toThrow();
  });
  it("reuses canonical check consumer with no network fallback", async () => {
    const head = "a".repeat(40);
    expect(await replayRequiredChecks({ [`commits/${head}/check-runs?filter=all&per_page=100&page=1`]: { total_count: 0, check_runs: [] } }, head)).toEqual(new Map());
    await expect(replayRequiredChecks({}, head)).rejects.toThrow("OFFLINE_EVIDENCE_MISSING");
    expect(() => verifyApprovedContract(".")).toThrow("EXPLICIT_CONTRACT_AUTHORITY_REQUIRED");
  });
  it("CSS comparator API preserves direct use", () => { expect(compareCss("view.module.css", ".a { margin: 0; }", ".a { margin: 4px; }", defaultPolicy)).toEqual(["scoped_css"]); });
});

// Offline reproduction of evaluator.py:storefront_strict_record and classify's
// exact binding at Platform b90a1b931d29755c40f81a030712a7d2fdc7cf57.
function platformStrictConsumer(record, identity) {
  const text = (value) => typeof value === "string" && value.trim().length > 0;
  const strings = (values) => Array.isArray(values) && values.every(text) && new Set(values).size === values.length;
  const digest = (value) => typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
  return record.schema_version === "1.0" && record.candidate_lane === strict && record.fallback_lane === strict
    && (record.effective_lane ?? strict) === strict
    && ["HUMAN_APPROVED", "PENDING_HUMAN_APPROVAL"].includes(record.policy_approval)
    && record.blocking_authority === false && record.ci_skip === false
    && ["policy_version", "impact_map_version", "classification_reason"].every((key) => text(record[key]))
    && ["policy_digest", "impact_map_digest"].every((key) => digest(record[key]))
    && ["unknown_reasons", "change_classes", "affected_modules", "affected_routes", "affected_states"].every((key) => strings(record[key]))
    && Array.isArray(record.evidence) && record.evidence.every((entry) => entry && text(entry.path) && strings(entry.classes) && entry.classes.length > 0
      && ["before_digest", "after_digest"].every((key) => typeof entry[key] === "string" && digest(`sha256:${entry[key]}`)))
    && ["repository", "base_sha", "head_sha", "tree_sha"].every((key) => record[key] === identity[key])
    && record.production_impact === "NONE" && record.record_digest === seal(record).record_digest;
}
describe("Platform pinned Strict consumer compatibility", () => {
  it("accepts actual Human-approved Strict record and exact binding", async () => {
    const data = input("scripts/readiness/classifier.mjs");
    const record = await classifyDiff(data);
    expect(platformStrictConsumer(record, { ...data, repository: "ideal-sol/luxe-pack-storefront" })).toBe(true);
  });
  it.each([
    ["candidate_lane", normal], ["fallback_lane", normal], ["ci_skip", true], ["blocking_authority", true],
    ["policy_approval", "UNKNOWN"], ["policy_digest", "bad"], ["impact_map_digest", "bad"],
    ["affected_modules", "wrong-type"], ["evidence", [{ path: "a", classes: ["copy"] }]],
    ["head_sha", "d".repeat(40)], ["production_impact", "PRESENT"],
  ])("rejects incompatible %s", async (key, value) => {
    const data = input("scripts/readiness/classifier.mjs");
    const record = seal({ ...await classifyDiff(data), [key]: value });
    expect(platformStrictConsumer(record, { ...data, repository: "ideal-sol/luxe-pack-storefront" })).toBe(false);
  });
});

describe("adversarial fallback and reference regressions", () => {
  it("Human-approved shadow policy never grants an operational Minor lane", async () => {
    const policy = { ...defaultPolicy, policy_approval: "HUMAN_APPROVED" };
    const result = await state(input(), "ELIGIBLE", policy);
    expect(result.candidate_lane).toBe(normal);
    expect(defaultPolicy.policy_approval).toBe("HUMAN_APPROVED");
    expect(defaultPolicy).not.toHaveProperty("approved_at");
    expect(defaultPolicy).not.toHaveProperty("approved_by_role");
  });
  it.each(["NOT_ELIGIBLE", "UNCLASSIFIED", "INDETERMINATE"])("%s + Platform NONE takes Normal in both fields", async (expected) => {
    const data = expected === "NOT_ELIGIBLE" ? declaration("display", "block", "none") : input();
    if (expected === "UNCLASSIFIED") data.changes[0].after = Buffer.from("export function {");
    if (expected === "INDETERMINATE") data.complete_diff = false;
    const record = await state(data, expected);
    expect(record.candidate_lane).toBe(normal); expect(record.fallback_lane).toBe(normal);
    expect(record).not.toHaveProperty("hold");
  });
  it("unresolved package imports are UNCLASSIFIED", async () => {
    const data = input(); data.head_sources[path] += ' import unknown from "nonexistent-readiness-package";';
    await state(data, "UNCLASSIFIED");
  });
  it("one mapped change cannot hide another unmapped change", async () => {
    const data = input();
    data.changes.push({ ...data.changes[0], path: "src/unmapped-view.tsx" });
    data.base_sources["src/unmapped-view.tsx"] = before; data.head_sources["src/unmapped-view.tsx"] = before.replace("Hello", "Welcome");
    await state(data, "UNCLASSIFIED");
  });
  it("resolves same-path public raster through literal JSX src", async () => {
    const sharp = createRequire(import.meta.resolve("next/package.json"))("sharp");
    const make = (color) => sharp({ create: { width: 8, height: 8, channels: 3, background: color } }).png().toBuffer();
    const data = input("public/static.png", await make("red"), await make("blue"));
    delete data.base_sources["public/static.png"]; delete data.head_sources["public/static.png"];
    data.base_sources[path] = data.head_sources[path] = 'export const Title = () => <img src="/static.png" alt="" />;';
    data.base_inventory = [...Object.keys(data.base_sources), "public/static.png"];
    data.head_inventory = [...Object.keys(data.head_sources), "public/static.png"];
    expect((await state(data, "ELIGIBLE")).affected_routes).toContain("/contact");
    data.changes.push(input().changes[0]);
    await state(data, "NOT_ELIGIBLE");
  });
});

describe("display text under unchanged conditions", () => {
  it("changes only literal ternary display branches", async () => {
    const old = 'export const V = () => <button>{pending ? "Sending" : "Send"}</button>;';
    await state(input(path, old, old.replace('"Sending"', '"Please wait"')), "ELIGIBLE");
    await state(input(path, old, old.replace("pending ?", "!pending ?").replace('"Sending"', '"Please wait"')), "NOT_ELIGIBLE");
  });
  it("accepts a literal placeholder expression without changing value or handler", async () => {
    const old = 'export const V = () => <input placeholder={"Before"} value={value} onChange={onChange} />;';
    await state(input(path, old, old.replace("Before", "After")), "ELIGIBLE");
  });
});

describe("PRG-20261005B presentation proof regressions", () => {
  it.each(["div", "span", "button", "p", "section", "a"])("native %s retains safe class and style support", async (tag) => {
    const previous = `export const V = () => <${tag} className="small" style={{ color: "red" }} />;`;
    await state(input(path, previous, previous.replace("small", "large").replace('"red"', '"blue"')), "ELIGIBLE");
  });
  it.each(["Widget", "MyButton", "Card", "UI.Button", "custom-widget", "unknownnative"])("unproved %s class forwarding is UNCLASSIFIED", async (tag) => {
    const previous = `export const V = () => <${tag} className="small" />;`;
    const result = await state(input(path, previous, previous.replace("small", "large")), "UNCLASSIFIED");
    expect(result.classification_reason).toBe("PRESENTATION_FORWARDING_UNPROVEN");
    expect(result.candidate_lane).toBe(normal);
    expect(result.fallback_lane).toBe(normal);
  });
  it.each(["Widget", "UI.Button", "custom-widget"])("unproved %s style forwarding is UNCLASSIFIED", async (tag) => {
    const previous = `export const V = () => <${tag} style={{ color: "red" }} />;`;
    await state(input(path, previous, previous.replace('"red"', '"blue"')), "UNCLASSIFIED");
  });
  it("does not accept className used as custom-component control flow", async () => {
    const previous = 'function Widget({ className }) { return className === "large" ? null : <div />; } export const V = () => <Widget className="small" />;';
    const next = previous.replace('className="small"', 'className="large"');
    await state(input(path, previous, next), "UNCLASSIFIED");
  });
  it("keeps even apparent custom forwarding unclassified without a forwarding proof", async () => {
    const previous = 'function Widget({ className }) { return <div className={className} />; } export const V = () => <Widget className="small" />;';
    await state(input(path, previous, previous.replace('className="small"', 'className="large"')), "UNCLASSIFIED");
  });
  it.each(['is="custom-button"', '{...props}'])("customized native element %s needs proof", async (attribute) => {
    const previous = `export const V = () => <button ${attribute} className="small" />;`;
    await state(input(path, previous, previous.replace("small", "large")), "UNCLASSIFIED");
  });
  it("native HTML policy binds the presentation decision", async () => {
    const policy = structuredClone(defaultPolicy);
    policy.native_html_elements = policy.native_html_elements.filter((tag) => tag !== "div");
    const previous = 'export const V = () => <div className="small" />;';
    await state(input(path, previous, previous.replace("small", "large")), "UNCLASSIFIED", policy);
  });
  it.each([
    '[class~="large"]', '[class="large"]', '[class*="large"]', '[class^="lar"]',
    '[CLASS~="LARGE" i]', '[class]', '[data-anything]', '.large[data-state="ready"]',
    '.large > p', '.ancestor .large', '.large.other', ':is(.large)', ':not(.other)',
    String.raw`.l\61rge`, '.large, .other', '#container', '*',
  ])("cannot exclude selector %s from a class change", async (selector) => {
    const data = input(path, before, before.replace("small", "large"));
    data.base_sources["src/styles/globals.css"] = data.head_sources["src/styles/globals.css"] = `${styles} ${selector} { display: none; }`;
    const result = await state(data, "UNCLASSIFIED");
    expect(result.classification_reason).toBe("CLASS_SELECTOR_UNRESOLVED");
    expect(result.fallback_lane).toBe(normal);
  });
  it.each(["base_sources", "head_sources"])("checks hidden selector dependencies in %s independently", async (tree) => {
    const data = input(path, before, before.replace("small", "large"));
    data[tree]["src/styles/globals.css"] += ' [class~="large"] { display: none; }';
    await state(data, "UNCLASSIFIED");
  });
  it("unresolved selectors also matter when the old token is removed", async () => {
    const data = input(path, before, before.replace("small", "large"));
    data.base_sources["src/styles/globals.css"] += ' [class~="small"] { display: none; }';
    await state(data, "UNCLASSIFIED");
  });
  it("accepts fully parsed hover selectors and excludes unrelated simple classes", async () => {
    const data = input(path, before, before.replace("small", "large"));
    data.base_sources["src/styles/globals.css"] = data.head_sources["src/styles/globals.css"] = `${styles} .large:hover { color: red; } .unrelated { display: none; }`;
    await state(data, "ELIGIBLE");
  });
  it("rejects a directly resolved dangerous declaration", async () => {
    const data = input(path, before, before.replace("small", "large"));
    data.base_sources["src/styles/globals.css"] = data.head_sources["src/styles/globals.css"] = '.small { color: blue; } .large { display: none; }';
    await state(data, "NOT_ELIGIBLE");
  });
  it("does not interpret nested rules as independent simple selectors", async () => {
    const data = input(path, before, before.replace("small", "large"));
    data.base_sources["src/styles/globals.css"] = data.head_sources["src/styles/globals.css"] = `${styles} .unrelated { .large { color: red; } }`;
    await state(data, "UNCLASSIFIED");
  });
  it("preserves Full fallback without Platform NONE even for unresolved presentation", async () => {
    const previous = 'export const V = () => <Widget className="small" />;';
    const data = input(path, previous, previous.replace("small", "large"));
    data.platform_impact = "UNKNOWN";
    const result = await state(data, "INDETERMINATE");
    expect(result.candidate_lane).toBe(full); expect(result.fallback_lane).toBe(full);
  });
});

describe("class selector context completeness", () => {
  it.each(['@scope (.large)', '@supports selector(.large)', '@container style(--class: large)'])("unresolved %s context cannot hide rules for other classes", async (context) => {
    const data = input(path, before, before.replace("small", "large"));
    data.base_sources["src/styles/globals.css"] = data.head_sources["src/styles/globals.css"] = `${styles} ${context} { .other { display: none; } }`;
    await state(data, "UNCLASSIFIED");
  });
  it("rejects nesting hidden by an intervening media block", async () => {
    const data = input(path, before, before.replace("small", "large"));
    data.base_sources["src/styles/globals.css"] = data.head_sources["src/styles/globals.css"] = `${styles} .other { @media screen { .large { color: red; } } }`;
    await state(data, "UNCLASSIFIED");
  });
  it("retains safe literal class resolution in existing media", async () => {
    const data = input(path, before, before.replace("small", "large"));
    data.base_sources["src/styles/globals.css"] = data.head_sources["src/styles/globals.css"] = `@media (min-width: 768px) { ${styles} }`;
    const result = await state(data, "ELIGIBLE");
    expect(result.browser_acceptance_plan.affected_breakpoints).toEqual(["(min-width: 768px)"]);
  });
});

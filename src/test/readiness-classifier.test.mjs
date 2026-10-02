import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { applyHandoff, classifyDiff, compareCss, compareTsx, defaultPolicy, defaultImpact, impactFor, seal } from "../../scripts/readiness/classifier.mjs";
import { replayRequiredChecks, verifyApprovedContract } from "../../scripts/readiness/adapters.mjs";

const normal = "Normal Storefront Release";
const minor = "Storefront Minor Change Fast Lane";
const fixturePolicy = () => ({ ...structuredClone(defaultPolicy), approved_at: "2026-10-02T00:00:00Z", approved_by_role: "human_operator" });
const path = "src/components/common/page-title.tsx";
const before = 'export function Title() { return <h1 className="p-2">Hello</h1>; }';

function input(file = path, previous = before, next = before.replace("p-2", "p-4")) {
  return {
    base_sha: "a".repeat(40), head_sha: "b".repeat(40), tree_sha: "c".repeat(40),
    complete_diff: true, baseline_matches: true, platform_impact: "NONE",
    changes: [{ path: file, status: "M", old_mode: "100644", new_mode: "100644", before: Buffer.from(previous), after: Buffer.from(next) }],
    base_sources: { [file]: previous.toString() }, head_sources: { [file]: next.toString() },
  };
}

describe("offline minor shadow classification", () => {
  it("uses AST, scope and impact for literal class changes", async () => {
    const result = await classifyDiff(input(), fixturePolicy());
    expect(result.candidate_lane).toBe(minor);
    expect(result.production_impact).toBe("NONE");
    expect(result.ci_skip).toBe(false);
    expect(result.browser_acceptance_plan.status).toBe("HUMAN_BROWSER_ACCEPTANCE_PENDING");
    expect(result.record_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("does not invent Human policy approval", async () => {
    const result = await classifyDiff(input());
    expect(result.candidate_lane).toBe(normal);
    expect(result.policy_approval).toBe("PENDING_HUMAN_APPROVAL");
    expect(result.unknown_reasons).toContain("MACHINE_POLICY_APPROVAL_PENDING");
    expect(result.evidence).toHaveLength(1);
  });

  it("supports noncritical literal copy", async () => {
    expect((await classifyDiff(input(path, before, before.replace("Hello", "Welcome")), fixturePolicy())).candidate_lane).toBe(minor);
  });

  it("supports critical-file class/style without accepting critical text", async () => {
    const critical = "src/components/payment/card-save-confirmation.tsx";
    expect((await classifyDiff(input(critical), fixturePolicy())).candidate_lane).toBe(minor);
    expect((await classifyDiff(input(critical, before, before.replace("Hello", "Pay")), fixturePolicy())).candidate_lane).toBe(normal);
    const styled = 'export function Title() { return <h1 style={{ padding: 4 }}>Hello</h1>; }';
    expect((await classifyDiff(input(critical, styled, styled.replace("padding: 4", "padding: 8")), fixturePolicy())).candidate_lane).toBe(minor);
  });

  it.each([
    ['onClick={() => send(1)}', 'onClick={() => send(2)}'],
    ['onSubmit={submit}', 'onSubmit={save}'],
    ['disabled={loading}', 'disabled={false}'],
    ['aria-label="Pay"', 'aria-label="Free"'],
    ['className={enabled ? "p-2" : "p-4"}', 'className={enabled ? "p-4" : "p-4"}'],
    ['style={{ padding: space }}', 'style={{ padding: 4 }}'],
    ['style={{ opacity: 1 }}', 'style={{ opacity: 0 }}'],
  ])("rejects behavioral or dynamic attribute change %s", async (oldAttribute, newAttribute) => {
    const oldSource = `export function Title() { return <h1 ${oldAttribute}>Hello</h1>; }`;
    expect((await classifyDiff(input(path, oldSource, oldSource.replace(oldAttribute, newAttribute)), fixturePolicy())).candidate_lane).toBe(normal);
  });

  it.each([
    ["const state = useState(1);", "const state = useState(2);"],
    ["useEffect(() => send(1), []);", "useEffect(() => send(2), []);"],
    ['fetch("/first");', 'fetch("/second");'],
    ['const payload = { amount: 1 };', 'const payload = { amount: 2 };'],
    ['router.push("/login");', 'router.push("/register");'],
    ['const show = true;', 'const show = false;'],
  ])("rejects code changes even with a presentation delta: %s", async (oldLogic, newLogic) => {
    const oldSource = before.replace("return", `${oldLogic} return`);
    const newSource = oldSource.replace(oldLogic, newLogic).replace("p-2", "p-4");
    expect((await classifyDiff(input(path, oldSource, newSource), fixturePolicy())).candidate_lane).toBe(normal);
  });

  it.each([
    before.replace("<h1", "<h2").replace("</h1>", "</h2>"),
    before.replace("Hello", "Hello<span>new</span>"),
    before.replace('<h1 className="p-2">Hello</h1>', '<><p>B</p><p>A</p></>'),
    before.replace("return <h1", "return enabled && <h1"),
    "export function {",
  ])("rejects DOM changes and parse errors", async (after) => {
    expect((await classifyDiff(input(path, before, after), fixturePolicy())).candidate_lane).toBe(normal);
  });

  it.each(["pnpm-lock.yaml", "package.json", "vendor/oripa/manifest.json", "next.config.ts", "src/proxy.ts", "src/lib/platform/payment-client.ts", ".github/workflows/ci.yml", "scripts/readiness/minor-policy.v1.json"])("rejects forbidden paths: %s", async (file) => {
    expect((await classifyDiff(input(file), fixturePolicy())).candidate_lane).not.toBe(minor);
  });

  it("rejects selector-referenced classes and dynamic selectors", () => {
    expect(() => compareTsx(path, before, before.replace("p-2", "p-4"), fixturePolicy(), { selector: 'document.querySelector(".p-2")' })).toThrow("JS_SELECTOR_REFERENCED_CLASS");
    expect(() => compareTsx(path, before, before.replace("p-2", "p-4"), fixturePolicy(), { selector: "document.querySelector(selector)" })).toThrow("DYNAMIC_SELECTOR_UNKNOWN");
  });

  it("accepts bounded scoped CSS", () => {
    expect(compareCss("src/components/common/title.module.css", ".title { padding: 4px; }", ".title { padding: 8px; }", fixturePolicy(), {})).toEqual(["scoped_css"]);
  });

  it.each(["display: none", "visibility: hidden", "pointer-events: none", "opacity: 0", "overflow: hidden", "clip-path: inset(0)", "z-index: 50", "position: fixed", "padding: var(--wide)", "padding: 999px"])("rejects sensitive CSS: %s", (declaration) => {
    expect(() => compareCss("src/components/common/title.module.css", ".title { padding: 4px; }", `.title { ${declaration}; }`, fixturePolicy(), {})).toThrow();
  });

  it.each([".title:focus { padding: 8px; }", ":root { --space: 8px; }", "* { padding: 0; }", ".title[disabled] { padding: 0; }", ".title .child { padding: 8px; }"])("rejects global/state/complex selectors", (css) => {
    expect(() => compareCss("src/components/common/title.module.css", ".title { padding: 4px; }", css, fixturePolicy(), {})).toThrow();
  });

  it("rejects global style even for allowed declarations", () => {
    expect(() => compareCss("src/styles/globals.css", ".title { padding: 4px; }", ".title { padding: 8px; }", fixturePolicy(), {})).toThrow("GLOBAL_STYLE_REJECTED");
  });

  it("expands shared dependencies through route importers", () => {
    const sources = {
      [path]: before,
      "src/components/contact/contact-form.tsx": 'import { Title } from "../common/page-title"; export const Form = () => <Title />;',
      "src/app/contact/page.tsx": 'import { Form } from "../../components/contact/contact-form"; export default Form;',
    };
    const impact = impactFor([path], sources);
    expect(impact.affected_routes).toContain("/contact");
    expect(impact.affected_modules).toContain("Contact");
    expect(impact.affected_components).toContain("src/app/contact/page.tsx");
  });

  it("fails closed on unresolved imports", () => {
    expect(() => impactFor([path], { [path]: 'import missing from "./missing";' })).toThrow("UNRESOLVED_SHARED_IMPORT");
  });

  it.each(["complete_diff", "baseline_matches"])("fails closed on missing proof: %s", async (key) => {
    const data = input();
    data[key] = false;
    expect((await classifyDiff(data, fixturePolicy())).candidate_lane).toBe(normal);
  });

  it("falls back to Full when Platform impact is unproven", async () => {
    const data = input();
    data.platform_impact = "UNKNOWN";
    expect((await classifyDiff(data, fixturePolicy())).candidate_lane).toBe("Full Platform + Storefront Release");
  });

  it("fails closed for unrecognized machine policy classes", async () => {
    const policy = fixturePolicy();
    policy.allowed_change_classes.push("handler");
    expect((await classifyDiff(input(), policy)).unknown_reasons).toContain("UNKNOWN_MACHINE_POLICY_CLASS");
  });

  it("validates decorative raster format, dimensions, growth and impact", async () => {
    const requireNext = createRequire(import.meta.resolve("next/package.json"));
    const sharp = requireNext("sharp");
    const image = async (color, width = 8) => sharp({ create: { width, height: 8, channels: 3, background: color } }).png().toBuffer();
    const oldImage = await image("red");
    const newImage = await image("blue");
    const data = input("src/assets/decorative/background.png", oldImage, newImage);
    data.base_sources = data.head_sources = {};
    expect((await classifyDiff(data, fixturePolicy())).candidate_lane).toBe(minor);
    data.changes[0].after = await image("blue", 9);
    expect((await classifyDiff(data, fixturePolicy())).candidate_lane).toBe(normal);
    data.changes[0].after = Buffer.from("not an image");
    expect((await classifyDiff(data, fixturePolicy())).candidate_lane).toBe(normal);
  });

  it("represents every required impact domain and canonical digest", () => {
    expect(defaultImpact.areas).toHaveLength(19);
    expect(seal({ text: "表示", version: "1.0" })).toEqual(seal({ version: "1.0", text: "表示" }));
  });

  it("binds offline handoff to exact source and requires Human evidence", () => {
    const data = input();
    const handoff = seal({ schema_version: "1.0", repository: "ideal-sol/luxe-pack-storefront",
      base_sha: data.base_sha, head_sha: data.head_sha, tree_sha: data.tree_sha,
      platform_impact: "NONE", evidence_reference: "fixture:human-confirmed", confirmed_by_role: "human_operator" });
    expect(applyHandoff(data, handoff).platform_impact).toBe("NONE");
    expect(() => applyHandoff({ ...data, head_sha: "d".repeat(40) }, handoff)).toThrow();
    expect(() => applyHandoff(data, { ...handoff, evidence_reference: "" })).toThrow();
  });

  it("reuses canonical check consumer without network fallback", async () => {
    const head = "a".repeat(40);
    expect(await replayRequiredChecks({ [`commits/${head}/check-runs?filter=all&per_page=100&page=1`]: {
      total_count: 0, check_runs: [],
    } }, head)).toEqual(new Map());
    await expect(replayRequiredChecks({}, head)).rejects.toThrow("OFFLINE_EVIDENCE_MISSING");
    expect(() => verifyApprovedContract(".")).toThrow("EXPLICIT_CONTRACT_AUTHORITY_REQUIRED");
  });
});

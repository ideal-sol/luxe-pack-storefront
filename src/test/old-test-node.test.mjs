import { describe, expect, it } from "vitest";
import { verifyRuntime } from "../../scripts/verify-old-test-node.mjs";

const input = () => ({ executable: "/opt/node/v22.23.5/bin/node", actualExecutable: "/opt/node/v22.23.5/bin/node",
  nodeVersion: "v22.23.5", nvmrc: "22.23.5\n",
  packageJson: { engines: { node: "22.23.5", pnpm: "10.12.1" }, packageManager: "pnpm@10.12.1" },
  versions: { next: "16.4.2", client: "2.0.0-alpha.52", testkit: "2.0.0-alpha.52" },
  manifest: { target: "old-test", node_version: "v22.23.5", pnpm_version: "10.12.1", next_version: "16.4.2",
    client_version: "2.0.0-alpha.52", testkit_version: "2.0.0-alpha.52", gtm_enabled: false, gtm_id: null } });

describe("OLD Test dedicated Node identity", () => {
  it("accepts matching absolute executable and new manifest", () => expect(verifyRuntime(input()).manifest_verified).toBe(true));
  it.each(["node", "/usr/bin/node-22"])("rejects a different executable %s", (executable) => {
    expect(() => verifyRuntime({ ...input(), executable })).toThrow("node_executable_mismatch");
  });
  it("rejects the old running Node", () => expect(() => verifyRuntime({ ...input(), nodeVersion: "v22.22.3" })).toThrow("node_version_mismatch"));
  it.each([ ["node_version", "v22.22.3"], ["gtm_enabled", true], ["gtm_id", "GTM-TEST"],
    ["client_version", "2.0.0-alpha.51"], ["target", "production"] ])("rejects incompatible manifest %s", (key, value) => {
    const valueSet = input(); valueSet.manifest[key] = value;
    expect(() => verifyRuntime(valueSet)).toThrow("manifest_toolchain_mismatch");
  });
});

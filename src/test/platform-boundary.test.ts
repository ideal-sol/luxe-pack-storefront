import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function filesUnder(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? filesUnder(child) : [child];
  });
}

it("keeps direct Platform paths outside application source", () => {
  const marker = "/api" + "/v2";
  const violations = filesUnder("src")
    .filter((path) => !path.endsWith("src/lib/platform/README.md"))
    .filter((path) => readFileSync(path, "utf8").includes(marker));
  expect(violations).toEqual([]);
});

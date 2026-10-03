import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "..", "package.json"), "utf8"),
) as {
  scripts: Record<string, string>;
  engines: { node: string };
};

/*
 * Phase 0 smoke test: proves the Vitest harness runs and guards the "CI-ready
 * commands exist" acceptance criterion. Replaced by real tests from Phase 1.
 */
describe("phase-0 scaffold", () => {
  it("declares every gate script", () => {
    for (const name of ["dev", "build", "start", "lint", "typecheck", "test"]) {
      expect(typeof pkg.scripts[name], `script "${name}" must exist`).toBe("string");
    }
  });

  it("pins a node engine range compatible with Next.js (>=20.9.0)", () => {
    expect(pkg.engines.node).toMatch(/>=20\.9\.0/);
  });

  it("is running on a node version inside the supported range", () => {
    const [major] = process.versions.node.split(".").map(Number);
    expect(major).toBeGreaterThanOrEqual(20);
  });
});

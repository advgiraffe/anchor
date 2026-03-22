import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigLoader } from "../../../src/config/ConfigLoader.js";

describe("ConfigLoader", () => {
  it("loads targets from .anchor.yaml", () => {
    const dir = mkdtempSync(join(tmpdir(), "anchor-config-"));

    try {
      writeFileSync(
        join(dir, ".anchor.yaml"),
        [
          "version: 3",
          "targets:",
          "  - name: ios",
          "    description: iOS team",
          "    fileGlobs:",
          "      - \"docs/mobile/**\"",
          "    minSeverity: BEHAVIORAL",
        ].join("\n"),
        "utf8",
      );

      const loader = new ConfigLoader();
      const config = loader.load(".anchor.yaml", dir);

      expect(config.version).toBe(3);
      expect(config.targets).toHaveLength(1);
      expect(config.targets[0].name).toBe("ios");
      expect(config.targets[0].fileGlobs).toEqual(["docs/mobile/**"]);
      expect(config.targets[0].minSeverity).toBe("BEHAVIORAL");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when config file is missing", () => {
    const loader = new ConfigLoader();
    const dir = mkdtempSync(join(tmpdir(), "anchor-config-missing-"));

    try {
      expect(() => loader.load(".anchor.yaml", dir)).toThrow("Config file not found");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when targets array is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "anchor-config-invalid-"));

    try {
      writeFileSync(join(dir, ".anchor.yaml"), "version: 3\n", "utf8");

      const loader = new ConfigLoader();
      expect(() => loader.load(".anchor.yaml", dir)).toThrow("must contain a 'targets' array");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

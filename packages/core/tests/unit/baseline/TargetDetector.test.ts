import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TargetDetector } from "../../../src/baseline/TargetDetector.js";

describe("TargetDetector", () => {
  it("detects backend and qa targets from package dependencies", () => {
    const dir = mkdtempSync(join(tmpdir(), "anchor-targets-"));

    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          {
            dependencies: { prisma: "latest" },
            devDependencies: { jest: "latest" },
          },
          null,
          2,
        ),
        "utf8",
      );

      const detector = new TargetDetector();
      const targets = detector.detect(dir);
      const names = targets.map((target) => target.name);

      expect(names).toContain("backend");
      expect(names).toContain("qa");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects ios/android from platform folders and files", () => {
    const dir = mkdtempSync(join(tmpdir(), "anchor-targets-mobile-"));

    try {
      mkdirSync(join(dir, "ios"), { recursive: true });
      mkdirSync(join(dir, "android"), { recursive: true });
      writeFileSync(join(dir, "ios", "App.swift"), "", "utf8");
      writeFileSync(join(dir, "android", "MainActivity.kt"), "", "utf8");

      const detector = new TargetDetector();
      const names = detector.detect(dir).map((target) => target.name);

      expect(names).toContain("ios");
      expect(names).toContain("android");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

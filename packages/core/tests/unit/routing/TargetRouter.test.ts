import { describe, expect, it } from "vitest";
import type { AnchorResult } from "../../../src/models/index.js";
import { TargetRouter, type RouteTarget } from "../../../src/routing/TargetRouter.js";

const sampleResult: AnchorResult = {
  metadata: {
    path: "docs",
    fromRef: "a",
    toRef: "b",
    generatedAt: "2026-03-22T00:00:00.000Z",
    totalFilesChanged: 3,
  },
  fileDeltas: [
    {
      path: "docs/api/auth.md",
      changeType: "MODIFIED",
      maxSeverity: "BREAKING",
      sectionDeltas: [],
    },
    {
      path: "docs/web/ui.md",
      changeType: "MODIFIED",
      maxSeverity: "BEHAVIORAL",
      sectionDeltas: [],
    },
    {
      path: "docs/shared/glossary.md",
      changeType: "MODIFIED",
      maxSeverity: "INFORMATIONAL",
      sectionDeltas: [],
    },
  ],
};

describe("TargetRouter", () => {
  const targets: RouteTarget[] = [
    {
      id: "backend",
      include: ["docs/api/**"],
    },
    {
      id: "frontend",
      include: ["docs/web/**", "docs/shared/**"],
      exclude: ["**/glossary.md"],
    },
  ];

  it("routes file deltas based on include/exclude patterns", () => {
    const router = new TargetRouter();
    const routes = router.route(sampleResult, targets);

    const backend = routes.find((route) => route.target.id === "backend");
    const frontend = routes.find((route) => route.target.id === "frontend");

    expect(backend?.fileDeltas).toHaveLength(1);
    expect(backend?.fileDeltas[0].path).toBe("docs/api/auth.md");
    expect(backend?.maxSeverity).toBe("BREAKING");

    expect(frontend?.fileDeltas).toHaveLength(1);
    expect(frontend?.fileDeltas[0].path).toBe("docs/web/ui.md");
    expect(frontend?.maxSeverity).toBe("BEHAVIORAL");
  });

  it("returns cosmetic severity for targets with no matching deltas", () => {
    const router = new TargetRouter();
    const routes = router.route(sampleResult, [
      {
        id: "mobile",
        include: ["docs/mobile/**"],
      },
    ]);

    expect(routes[0].fileDeltas).toHaveLength(0);
    expect(routes[0].maxSeverity).toBe("COSMETIC");
  });
});

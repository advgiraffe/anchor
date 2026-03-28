import { describe, expect, it } from "vitest";
import { InstructionGenerator } from "../../../../src/core/llm/InstructionGenerator.js";
import type { TargetRoute } from "../../../../src/core/routing/TargetRouter.js";

describe("InstructionGenerator", () => {
  it("builds per-target instruction text from routed deltas", () => {
    const routes: TargetRoute[] = [
      {
        target: {
          id: "frontend",
          description: "Web UI team",
          include: ["docs/web/**"],
        },
        maxSeverity: "BEHAVIORAL",
        fileDeltas: [
          {
            path: "docs/web/ui.md",
            changeType: "MODIFIED",
            maxSeverity: "BEHAVIORAL",
            sectionDeltas: [
              {
                sectionId: "ux",
                title: "UX Requirements",
                changeType: "MODIFIED",
                severity: "BEHAVIORAL",
                summary: "Flow updated",
              },
            ],
          },
        ],
      },
      {
        target: {
          id: "empty",
          include: ["docs/none/**"],
        },
        maxSeverity: "COSMETIC",
        fileDeltas: [],
      },
    ];

    const generator = new InstructionGenerator();
    const instructions = generator.generate(routes);

    expect(instructions).toHaveLength(1);
    expect(instructions[0].targetId).toBe("frontend");
    expect(instructions[0].maxSeverity).toBe("BEHAVIORAL");
    expect(instructions[0].instruction).toContain("Target: frontend");
    expect(instructions[0].instruction).toContain("Purpose: Web UI team");
    expect(instructions[0].instruction).toContain("BEHAVIORAL MODIFIED section \"UX Requirements\"");
  });
});

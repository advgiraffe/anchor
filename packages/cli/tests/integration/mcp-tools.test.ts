import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Severity } from "../../src/core/index.js";
import { AnchorMcpServer } from "../../src/mcp/McpServer.js";
import { createTempGitRepo } from "../../../../tests/helpers/tempGitRepo.js";

// Deterministic classifier for integration tests — no real LLM calls.
const testClassifier = {
  async classifyChange(
    _title: string,
    _oldContent: string | undefined,
    _newContent: string | undefined,
    changeType: "ADDED" | "REMOVED" | "MODIFIED",
  ): Promise<{ severity: Severity; summary: string; reasoning: string }> {
    const severityByChangeType: Record<string, Severity> = {
      ADDED: "INFORMATIONAL",
      MODIFIED: "BEHAVIORAL",
      REMOVED: "BREAKING",
    };
    return {
      severity: severityByChangeType[changeType] ?? "COSMETIC",
      summary: `section ${changeType.toLowerCase()}`,
      reasoning: "deterministic test classifier",
    };
  },
};

async function makeClient(cwd: string): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const server = new AnchorMcpServer({ cwd, classifier: testClassifier });
  await server.connect(serverTransport);

  const client = new Client({ name: "anchor-test-client", version: "1.0.0" });
  await client.connect(clientTransport);

  return {
    client,
    close: async () => client.close(),
  };
}

describe("MCP tools integration", () => {
  describe("anchor_compare", () => {
    it("returns section deltas for a modified file between two git refs (json)", async () => {
      const repo = createTempGitRepo();

      try {
        const fromRef = repo.commitFile(
          "docs/spec.md",
          ["# API", "", "## Authentication", "Use API key.", "", "## Errors", "401 Unauthorized"].join("\n"),
          "seed spec",
        );

        const toRef = repo.commitFile(
          "docs/spec.md",
          ["# API", "", "## Authentication", "Use OAuth token.", "", "## Rate Limiting", "100 req/hour"].join("\n"),
          "update spec",
        );

        const { client, close } = await makeClient(repo.dir);

        try {
          const result = await client.callTool({
            name: "anchor_compare",
            arguments: {
              filePath: "docs/spec.md",
              fromRef,
              toRef,
              format: "json",
            },
          });

          expect(result.content).toHaveLength(1);
          expect(result.content[0].type).toBe("text");

          const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
          expect(parsed.fileDeltas).toHaveLength(1);
          expect(parsed.fileDeltas[0].path).toBe("docs/spec.md");
          expect(parsed.fileDeltas[0].changeType).toBe("MODIFIED");
          expect(parsed.fileDeltas[0].sectionDeltas.length).toBeGreaterThan(0);

          const modified = parsed.fileDeltas[0].sectionDeltas.find(
            (d: { title: string; changeType: string }) => d.title === "Authentication" && d.changeType === "MODIFIED",
          );
          expect(modified).toBeDefined();
          expect(modified.severity).toBe("BEHAVIORAL");

          const removed = parsed.fileDeltas[0].sectionDeltas.find(
            (d: { title: string; changeType: string }) => d.title === "Errors" && d.changeType === "REMOVED",
          );
          expect(removed).toBeDefined();
          expect(removed.severity).toBe("BREAKING");
        } finally {
          await close();
        }
      } finally {
        repo.cleanup();
      }
    });

    it("returns text-format output for a modified file", async () => {
      const repo = createTempGitRepo();

      try {
        const fromRef = repo.commitFile(
          "spec.md",
          ["# API", "", "## Auth", "Use API key."].join("\n"),
          "seed spec",
        );

        const toRef = repo.commitFile(
          "spec.md",
          ["# API", "", "## Auth", "Use OAuth token."].join("\n"),
          "update spec",
        );

        const { client, close } = await makeClient(repo.dir);

        try {
          const result = await client.callTool({
            name: "anchor_compare",
            arguments: {
              filePath: "spec.md",
              fromRef,
              toRef,
              format: "text",
            },
          });

          const text = (result.content[0] as { type: "text"; text: string }).text;
          expect(text).toContain("spec.md");
          expect(text).toContain("MODIFIED");
        } finally {
          await close();
        }
      } finally {
        repo.cleanup();
      }
    });
  });

  describe("anchor_compare_corpus", () => {
    it("returns per-file deltas for corpus changes (json)", async () => {
      const repo = createTempGitRepo();

      try {
        const fromRef = repo.commitFile(
          "docs/spec-a.md",
          ["# Spec A", "", "## Auth", "Use API key."].join("\n"),
          "seed spec-a",
        );

        repo.commitFile(
          "docs/spec-a.md",
          ["# Spec A", "", "## Auth", "Use OAuth token."].join("\n"),
          "modify spec-a",
        );

        repo.commitFile(
          "docs/spec-b.md",
          ["# Spec B", "", "## Errors", "404 Not Found"].join("\n"),
          "add spec-b",
        );

        const toRef = repo.commitFile(
          "other/ignore.md",
          "outside corpus",
          "outside corpus",
        );

        const { client, close } = await makeClient(repo.dir);

        try {
          const result = await client.callTool({
            name: "anchor_compare_corpus",
            arguments: {
              folderPath: "docs",
              fromRef,
              toRef,
              format: "json",
            },
          });

          const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
          expect(parsed.fileDeltas).toBeDefined();

          // spec-a modified, spec-b added
          const specA = parsed.fileDeltas.find((d: { path: string }) => d.path === "docs/spec-a.md");
          const specB = parsed.fileDeltas.find((d: { path: string }) => d.path === "docs/spec-b.md");
          const outside = parsed.fileDeltas.find((d: { path: string }) => d.path.startsWith("other/"));

          expect(specA).toBeDefined();
          expect(specA.changeType).toBe("MODIFIED");
          expect(specB).toBeDefined();
          expect(specB.changeType).toBe("ADDED");
          expect(outside).toBeUndefined();
        } finally {
          await close();
        }
      } finally {
        repo.cleanup();
      }
    });
  });

  describe("anchor_targets", () => {
    it("returns empty targets array when no config file exists (json)", async () => {
      const repo = createTempGitRepo();
      repo.commitFile("README.md", "# test", "init");

      try {
        const { client, close } = await makeClient(repo.dir);

        try {
          const result = await client.callTool({
            name: "anchor_targets",
            arguments: { format: "json" },
          });

          const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
          expect(Array.isArray(parsed)).toBe(true);
        } finally {
          await close();
        }
      } finally {
        repo.cleanup();
      }
    });

    it("returns configured targets from .anchor.yaml", async () => {
      const repo = createTempGitRepo();
      repo.commitFile("README.md", "# test", "init");

      const config = [
        "version: 1",
        "targets:",
        "  - name: backend",
        "    fileGlobs:",
        "      - src/**/*.ts",
        "  - name: frontend",
        "    fileGlobs:",
        "      - pages/**/*.tsx",
      ].join("\n");

      writeFileSync(join(repo.dir, ".anchor.yaml"), config, "utf8");

      try {
        const { client, close } = await makeClient(repo.dir);

        try {
          const result = await client.callTool({
            name: "anchor_targets",
            arguments: { format: "json" },
          });

          const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
          expect(parsed).toHaveLength(2);
          expect(parsed[0].name).toBe("backend");
          expect(parsed[1].name).toBe("frontend");
        } finally {
          await close();
        }
      } finally {
        repo.cleanup();
      }
    });

    it("returns table format when requested", async () => {
      const repo = createTempGitRepo();
      repo.commitFile("README.md", "# test", "init");

      writeFileSync(
        join(repo.dir, ".anchor.yaml"),
        ["version: 1", "targets:", "  - name: api", "    fileGlobs:", "      - src/**"].join("\n"),
        "utf8",
      );

      try {
        const { client, close } = await makeClient(repo.dir);

        try {
          const result = await client.callTool({
            name: "anchor_targets",
            arguments: { format: "table" },
          });

          const text = (result.content[0] as { type: "text"; text: string }).text;
          expect(text).toContain("api");
          expect(text).toContain("src/**");
        } finally {
          await close();
        }
      } finally {
        repo.cleanup();
      }
    });
  });

  describe("anchor_baseline_status", () => {
    it("returns placeholder status for an uninitialised baseline (json)", async () => {
      const repo = createTempGitRepo();
      repo.commitFile("README.md", "# test", "init");

      try {
        const { client, close } = await makeClient(repo.dir);

        try {
          const result = await client.callTool({
            name: "anchor_baseline_status",
            arguments: { format: "json" },
          });

          const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
          expect(parsed.hasBaseline).toBe(false);
        } finally {
          await close();
        }
      } finally {
        repo.cleanup();
      }
    });
  });

  describe("tool listing", () => {
    it("exposes all four anchor tools", async () => {
      const repo = createTempGitRepo();
      repo.commitFile("README.md", "# test", "init");

      try {
        const { client, close } = await makeClient(repo.dir);

        try {
          const { tools } = await client.listTools();
          const names = tools.map((t) => t.name);

          expect(names).toContain("anchor_compare");
          expect(names).toContain("anchor_compare_corpus");
          expect(names).toContain("anchor_targets");
          expect(names).toContain("anchor_baseline_status");
        } finally {
          await close();
        }
      } finally {
        repo.cleanup();
      }
    });
  });
});

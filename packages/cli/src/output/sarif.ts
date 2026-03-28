import type { AnchorResult, Severity } from "../core/index.js";

interface SarifLog {
  version: "2.1.0";
  $schema: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        informationUri: string;
        rules: SarifRule[];
      };
    };
    results: SarifResult[];
  }>;
}

interface SarifRule {
  id: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  defaultConfiguration: { level: "error" | "warning" | "note" };
  properties: { tags: string[] };
}

interface SarifResult {
  ruleId: string;
  level: "error" | "warning" | "note";
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: {
        uri: string;
      };
    };
  }>;
}

export function formatSarif(result: AnchorResult): string {
  const usedSeverities = new Set<Severity>();
  const sarifResults: SarifResult[] = [];

  for (const fileDelta of result.fileDeltas) {
    if (fileDelta.sectionDeltas.length === 0) {
      // Keep file-level changes visible even when no section-level deltas were detected.
      sarifResults.push({
        ruleId: `ANCHOR_${fileDelta.maxSeverity}`,
        level: severityToSarifLevel(fileDelta.maxSeverity),
        message: {
          text: `${fileDelta.changeType} file ${fileDelta.path} (${fileDelta.maxSeverity})`,
        },
        locations: [{
          physicalLocation: {
            artifactLocation: {
              uri: fileDelta.path,
            },
          },
        }],
      });
      usedSeverities.add(fileDelta.maxSeverity);
      continue;
    }

    for (const sectionDelta of fileDelta.sectionDeltas) {
      usedSeverities.add(sectionDelta.severity);
      sarifResults.push({
        ruleId: `ANCHOR_${sectionDelta.severity}`,
        level: severityToSarifLevel(sectionDelta.severity),
        message: {
          text: `${sectionDelta.changeType} section \"${sectionDelta.title}\" in ${fileDelta.path}${sectionDelta.summary ? `: ${sectionDelta.summary}` : ""}`,
        },
        locations: [{
          physicalLocation: {
            artifactLocation: {
              uri: fileDelta.path,
            },
          },
        }],
      });
    }
  }

  const rules = Array.from(usedSeverities).map((severity) => severityRule(severity));

  const sarif: SarifLog = {
    version: "2.1.0",
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "anchor",
            informationUri: "https://github.com/advgiraffe/anchor",
            rules,
          },
        },
        results: sarifResults,
      },
    ],
  };

  return `${JSON.stringify(sarif, null, 2)}\n`;
}

function severityRule(severity: Severity): SarifRule {
  return {
    id: `ANCHOR_${severity}`,
    shortDescription: { text: `Anchor ${severity.toLowerCase()} requirement change` },
    fullDescription: {
      text: `A requirement delta classified as ${severity}.`,
    },
    defaultConfiguration: { level: severityToSarifLevel(severity) },
    properties: {
      tags: ["anchor", "requirements", severity.toLowerCase()],
    },
  };
}

function severityToSarifLevel(severity: Severity): "error" | "warning" | "note" {
  if (severity === "BREAKING") {
    return "error";
  }
  if (severity === "BEHAVIORAL") {
    return "warning";
  }
  return "note";
}


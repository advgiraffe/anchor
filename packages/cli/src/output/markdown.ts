import type { AnchorResult } from "../core/index.js";

export function formatMarkdown(result: AnchorResult): string {
	const lines: string[] = [];

	lines.push("# Anchor Compare Report");
	lines.push("");
	lines.push(`- Path: ${result.metadata.path}`);
	lines.push(`- From: ${result.metadata.fromRef}`);
	lines.push(`- To: ${result.metadata.toRef}`);
	lines.push(`- Generated: ${result.metadata.generatedAt}`);
	lines.push(`- Files changed: ${result.metadata.totalFilesChanged}`);
	lines.push("");

	if (result.fileDeltas.length === 0) {
		lines.push("No file changes detected.");
		lines.push("");
		return lines.join("\n");
	}

	for (const fileDelta of result.fileDeltas) {
		lines.push(`## ${fileDelta.path}`);
		lines.push("");
		lines.push(`- Change: ${fileDelta.changeType}`);
		lines.push(`- Max severity: ${fileDelta.maxSeverity}`);
		lines.push("");

		if (fileDelta.sectionDeltas.length === 0) {
			lines.push("No section deltas detected.");
			lines.push("");
			continue;
		}

		for (const sectionDelta of fileDelta.sectionDeltas) {
			lines.push(`- [${sectionDelta.severity}] ${sectionDelta.changeType} ${sectionDelta.title}`);
			if (sectionDelta.summary) {
				lines.push(`  - ${sectionDelta.summary}`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

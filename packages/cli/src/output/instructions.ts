import type { AnchorResult } from "@anchor_app/core";

export function formatInstructions(result: AnchorResult): string {
	const lines: string[] = [];

	lines.push("Anchor change instructions");
	lines.push("");
	lines.push(`Scope: ${result.metadata.path}`);
	lines.push(`Refs: ${result.metadata.fromRef} -> ${result.metadata.toRef}`);
	lines.push(`Files changed: ${result.metadata.totalFilesChanged}`);
	lines.push("");

	if (result.fileDeltas.length === 0) {
		lines.push("No action needed: no requirement deltas detected.");
		lines.push("");
		return lines.join("\n");
	}

	lines.push("Action items:");

	for (const fileDelta of result.fileDeltas) {
		lines.push(`- Review ${fileDelta.path} (${fileDelta.changeType}, max severity ${fileDelta.maxSeverity})`);

		for (const sectionDelta of fileDelta.sectionDeltas) {
			const summary = sectionDelta.summary ? `: ${sectionDelta.summary}` : "";
			lines.push(
				`  - ${sectionDelta.severity} ${sectionDelta.changeType} in \"${sectionDelta.title}\"${summary}`,
			);
		}
	}

	lines.push("");
	return lines.join("\n");
}

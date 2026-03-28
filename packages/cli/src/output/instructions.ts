import { InstructionGenerator, TargetRouter, type AnchorResult } from "../core/index.js";

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

	const router = new TargetRouter();
	const routes = router.route(result, [
		{
			id: "default",
			description: "General implementation target",
			include: ["**/*"],
		},
	]);

	const generator = new InstructionGenerator();
	const generated = generator.generate(routes);

	if (generated.length === 0) {
		lines.push("No action needed: no requirement deltas detected.");
		lines.push("");
		return lines.join("\n");
	}

	lines.push(generated[0].instruction.trimEnd());
	lines.push("");
	return lines.join("\n");
}

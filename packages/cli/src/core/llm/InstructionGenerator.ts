import type { Severity } from "../models/index.js";
import type { TargetRoute } from "../routing/TargetRouter.js";

export interface TargetInstruction {
	targetId: string;
	maxSeverity: Severity;
	instruction: string;
}

export class InstructionGenerator {
	generate(routes: TargetRoute[]): TargetInstruction[] {
		return routes
			.filter((route) => route.fileDeltas.length > 0)
			.map((route) => {
				const lines: string[] = [];
				lines.push(`Target: ${route.target.id}`);
				if (route.target.description) {
					lines.push(`Purpose: ${route.target.description}`);
				}
				lines.push(`Max severity: ${route.maxSeverity}`);
				lines.push("Required actions:");

				for (const fileDelta of route.fileDeltas) {
					lines.push(`- Review ${fileDelta.path} (${fileDelta.changeType}, max severity ${fileDelta.maxSeverity})`);
					for (const sectionDelta of fileDelta.sectionDeltas) {
						const summary = sectionDelta.summary ? `: ${sectionDelta.summary}` : "";
						lines.push(
							`  - ${sectionDelta.severity} ${sectionDelta.changeType} section \"${sectionDelta.title}\"${summary}`,
						);
					}
				}

				return {
					targetId: route.target.id,
					maxSeverity: route.maxSeverity,
					instruction: `${lines.join("\n")}\n`,
				};
			});
	}
}

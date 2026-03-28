import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { stringify } from "yaml";
import type { AnchorTargetConfig } from "../config/AnchorConfig.js";
import type { BaselineSection } from "./SectionGenerator.js";

export interface CorpusWriteInput {
	outputPath: string;
	sections: BaselineSection[];
	targets: AnchorTargetConfig[];
	dryRun?: boolean;
}

export interface CorpusWriteResult {
	outputPath: string;
	configPath: string;
	writtenFiles: string[];
	dryRun: boolean;
}

export class CorpusWriter {
	write(input: CorpusWriteInput): CorpusWriteResult {
		const outputPath = resolve(input.outputPath);
		const writtenFiles: string[] = [];

		for (const section of input.sections) {
			const absolutePath = join(outputPath, section.path);
			writtenFiles.push(absolutePath);

			if (input.dryRun) {
				continue;
			}

			mkdirSync(dirname(absolutePath), { recursive: true });
			writeFileSync(absolutePath, section.content, "utf8");
		}

		const configPath = join(outputPath, ".anchor.yaml");
		writtenFiles.push(configPath);

		if (!input.dryRun) {
			mkdirSync(outputPath, { recursive: true });
			writeFileSync(
				configPath,
				stringify({
					version: 3,
					targets: input.targets.map((target) => ({
						name: target.name,
						description: target.description,
						fileGlobs: target.fileGlobs,
						excludeGlobs: target.excludeGlobs,
						minSeverity: target.minSeverity,
					})),
				}),
				"utf8",
			);
		}

		return {
			outputPath,
			configPath,
			writtenFiles,
			dryRun: Boolean(input.dryRun),
		};
	}
}

import { AnchorError } from "../errors/AnchorError.js";
import { GitExtractor } from "../git/GitExtractor.js";
import { GitTreeDiffer, type GitTreeChange } from "../git/GitTreeDiffer.js";
import type { ChangeType } from "../models/index.js";
import { SectionDiffer, type SectionChange } from "./text/SectionDiffer.js";
import { MarkdownParser } from "./text/parsers/MarkdownParser.js";

export interface CorpusFileChange {
	path: string;
	changeType: Extract<ChangeType, "ADDED" | "REMOVED" | "MODIFIED" | "RENAMED">;
	oldPath?: string;
	sectionChanges: SectionChange[];
}

export interface CorpusTreeDifferDependencies {
	repoPath?: string;
	gitExtractor?: GitExtractor;
	gitTreeDiffer?: GitTreeDiffer;
	parser?: MarkdownParser;
	differ?: SectionDiffer;
}

export class CorpusTreeDiffer {
	private readonly gitExtractor: GitExtractor;
	private readonly gitTreeDiffer: GitTreeDiffer;
	private readonly parser: MarkdownParser;
	private readonly differ: SectionDiffer;

	constructor(deps: CorpusTreeDifferDependencies = {}) {
		const repoPath = deps.repoPath ?? process.cwd();
		this.gitExtractor = deps.gitExtractor ?? new GitExtractor(repoPath);
		this.gitTreeDiffer = deps.gitTreeDiffer ?? new GitTreeDiffer(repoPath);
		this.parser = deps.parser ?? new MarkdownParser();
		this.differ = deps.differ ?? new SectionDiffer();
	}

	async diff(fromRef: string, toRef: string, corpusPath: string): Promise<CorpusFileChange[]> {
		const treeChanges = await this.gitTreeDiffer.diff(fromRef, toRef, corpusPath);
		const results: CorpusFileChange[] = [];

		for (const treeChange of treeChanges) {
			const oldPath = treeChange.oldPath ?? treeChange.path;
			const oldContent =
				treeChange.changeType === "ADDED"
					? ""
					: (await this.safeExtract(fromRef, oldPath)) ?? "";
			const newContent =
				treeChange.changeType === "REMOVED"
					? ""
					: (await this.safeExtract(toRef, treeChange.path)) ?? "";

			const oldSections = this.parser.parse(oldContent);
			const newSections = this.parser.parse(newContent);
			const sectionChanges = this.differ.diff(oldSections, newSections);

			results.push({
				path: treeChange.path,
				oldPath: treeChange.oldPath,
				changeType: treeChange.changeType,
				sectionChanges,
			});
		}

		return results;
	}

	private async safeExtract(ref: string, path: string): Promise<string | undefined> {
		try {
			return await this.gitExtractor.extractFileAtRef(ref, path);
		} catch (error) {
			if (error instanceof AnchorError && error.code === "GIT_FILE_NOT_FOUND") {
				return undefined;
			}
			throw error;
		}
	}
}

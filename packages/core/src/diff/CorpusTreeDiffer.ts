import { AnchorError } from "../errors/AnchorError.js";
import { GitExtractor } from "../git/GitExtractor.js";
import { GitTreeDiffer, type GitTreeChange } from "../git/GitTreeDiffer.js";
import type { ChangeType, ImageDelta } from "../models/index.js";
import { SectionDiffer, type SectionChange } from "./text/SectionDiffer.js";
import { MarkdownParser } from "./text/parsers/MarkdownParser.js";
import { ImageChangeDetector } from "./images/ImageChangeDetector.js";
import { extname } from "node:path";

const IMAGE_EXTENSIONS = new Set([
	".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp", ".tiff", ".tif",
]);

function isImageFile(filePath: string): boolean {
	return IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export interface CorpusFileChange {
	path: string;
	changeType: Extract<ChangeType, "ADDED" | "REMOVED" | "MODIFIED" | "RENAMED">;
	oldPath?: string;
	sectionChanges: SectionChange[];
}

export interface CorpusDiffResult {
	fileChanges: CorpusFileChange[];
	imageChanges: ImageDelta[];
}

export interface CorpusTreeDifferDependencies {
	repoPath?: string;
	gitExtractor?: GitExtractor;
	gitTreeDiffer?: GitTreeDiffer;
	parser?: MarkdownParser;
	differ?: SectionDiffer;
	imageDetector?: ImageChangeDetector;
}

export class CorpusTreeDiffer {
	private readonly gitExtractor: GitExtractor;
	private readonly gitTreeDiffer: GitTreeDiffer;
	private readonly parser: MarkdownParser;
	private readonly differ: SectionDiffer;
	private readonly imageDetector: ImageChangeDetector;

	constructor(deps: CorpusTreeDifferDependencies = {}) {
		const repoPath = deps.repoPath ?? process.cwd();
		this.gitExtractor = deps.gitExtractor ?? new GitExtractor(repoPath);
		this.gitTreeDiffer = deps.gitTreeDiffer ?? new GitTreeDiffer(repoPath);
		this.parser = deps.parser ?? new MarkdownParser();
		this.differ = deps.differ ?? new SectionDiffer();
		this.imageDetector = deps.imageDetector ?? new ImageChangeDetector();
	}

	async diff(fromRef: string, toRef: string, corpusPath: string): Promise<CorpusDiffResult> {
		const treeChanges = await this.gitTreeDiffer.diff(fromRef, toRef, corpusPath);
		const fileChanges: CorpusFileChange[] = [];
		const imageChanges: ImageDelta[] = [];

		for (const treeChange of treeChanges) {
			if (isImageFile(treeChange.path)) {
				const imageDelta = await this.processImageChange(treeChange, fromRef, toRef);
				imageChanges.push(imageDelta);
			} else {
				const fileChange = await this.processTextChange(treeChange, fromRef, toRef);
				fileChanges.push(fileChange);
			}
		}

		return { fileChanges, imageChanges };
	}

	private async processTextChange(treeChange: GitTreeChange, fromRef: string, toRef: string): Promise<CorpusFileChange> {
		const oldPath = treeChange.oldPath ?? treeChange.path;
		const oldContent =
			treeChange.changeType === "ADDED" ? "" : (await this.safeExtract(fromRef, oldPath)) ?? "";
		const newContent =
			treeChange.changeType === "REMOVED" ? "" : (await this.safeExtract(toRef, treeChange.path)) ?? "";

		const oldSections = this.parser.parse(oldContent);
		const newSections = this.parser.parse(newContent);
		const sectionChanges = this.differ.diff(oldSections, newSections);

		return {
			path: treeChange.path,
			oldPath: treeChange.oldPath,
			changeType: treeChange.changeType,
			sectionChanges,
		};
	}

	private async processImageChange(treeChange: GitTreeChange, fromRef: string, toRef: string): Promise<ImageDelta> {
		const oldPath = treeChange.oldPath ?? treeChange.path;
		// RENAMED images are treated as MODIFIED for image comparison purposes
		const effectiveType = treeChange.changeType === "RENAMED" ? "MODIFIED" : treeChange.changeType;

		const fromBuffer =
			effectiveType !== "ADDED"
				? await this.safeExtractBinary(fromRef, oldPath)
				: null;
		const toBuffer =
			effectiveType !== "REMOVED"
				? await this.safeExtractBinary(toRef, treeChange.path)
				: null;

		return this.imageDetector.detectChange(fromBuffer, toBuffer, treeChange.path, effectiveType);
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

	private async safeExtractBinary(ref: string, path: string): Promise<Buffer | null> {
		try {
			return await this.gitExtractor.extractBinaryAtRef(ref, path);
		} catch (error) {
			if (error instanceof AnchorError && error.code === "GIT_FILE_NOT_FOUND") {
				return null;
			}
			throw error;
		}
	}
}

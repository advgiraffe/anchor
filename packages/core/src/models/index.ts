export type Severity = "BREAKING" | "BEHAVIORAL" | "INFORMATIONAL" | "COSMETIC";

export type ChangeType = "ADDED" | "REMOVED" | "MODIFIED" | "RENAMED" | "REORDERED";

export interface SectionDelta {
	sectionId: string;
	title: string;
	changeType: ChangeType;
	severity: Severity;
	summary?: string;
}

export interface FileDelta {
	path: string;
	changeType: ChangeType;
	maxSeverity: Severity;
	sectionDeltas: SectionDelta[];
}

export interface CorpusMetadata {
	path: string;
	fromRef: string;
	toRef: string;
	generatedAt: string;
	totalFilesChanged: number;
}

export interface AnchorResult {
	metadata: CorpusMetadata;
	fileDeltas: FileDelta[];
}

export type ImageRole = "wireframe" | "screenshot" | "diagram" | "icon_or_asset" | "unknown";

export interface ImageDelta {
	path: string;
	changeType: Extract<ChangeType, "ADDED" | "REMOVED" | "MODIFIED">;
	role: ImageRole;
	severity: Severity;
	/** Perceptual hash Hamming distance (0–64). Undefined when sharp is unavailable. */
	pHashDistance?: number;
	/** True when the SHA-256 of both blobs matched (byte-identical, no visual change). */
	shaMatch: boolean;
}

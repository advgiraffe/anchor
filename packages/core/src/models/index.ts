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

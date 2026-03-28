import type { Severity } from "../models/index.js";

export interface AnchorTargetConfig {
	name: string;
	description?: string;
	fileGlobs: string[];
	excludeGlobs?: string[];
	sections?: string[];
	keywords?: string[];
	imageRoles?: string[];
	minSeverity?: Severity;
}

export interface AnchorConfig {
	version?: number;
	targets: AnchorTargetConfig[];
}

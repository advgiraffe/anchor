import type { AnchorResult, FileDelta, Severity } from "../models/index.js";
import { GlobMatcher } from "./GlobMatcher.js";

export interface RouteTarget {
	id: string;
	description?: string;
	include: string[];
	exclude?: string[];
}

export interface TargetRoute {
	target: RouteTarget;
	fileDeltas: FileDelta[];
	maxSeverity: Severity;
}

export class TargetRouter {
	private readonly matcher: GlobMatcher;

	constructor(matcher: GlobMatcher = new GlobMatcher()) {
		this.matcher = matcher;
	}

	route(result: AnchorResult, targets: RouteTarget[]): TargetRoute[] {
		return targets.map((target) => {
			const fileDeltas = result.fileDeltas.filter((fileDelta) => this.fileMatchesTarget(fileDelta.path, target));

			return {
				target,
				fileDeltas,
				maxSeverity: maxSeverity(fileDeltas),
			};
		});
	}

	private fileMatchesTarget(path: string, target: RouteTarget): boolean {
		const included = this.matcher.matchesAny(path, target.include);
		if (!included) {
			return false;
		}

		if (!target.exclude || target.exclude.length === 0) {
			return true;
		}

		return !this.matcher.matchesAny(path, target.exclude);
	}
}

const severityOrder: Record<Severity, number> = {
	BREAKING: 4,
	BEHAVIORAL: 3,
	INFORMATIONAL: 2,
	COSMETIC: 1,
};

function maxSeverity(fileDeltas: FileDelta[]): Severity {
	if (fileDeltas.length === 0) {
		return "COSMETIC";
	}

	return fileDeltas.reduce((currentMax, fileDelta) => {
		if (severityOrder[fileDelta.maxSeverity] > severityOrder[currentMax]) {
			return fileDelta.maxSeverity;
		}
		return currentMax;
	}, "COSMETIC" as Severity);
}

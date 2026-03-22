export {};
import type { ChangeType, ImageDelta, ImageRole, Severity } from "../../models/index.js";
import { classifyImageRole } from "./ImageRoleClassifier.js";
import { computeImageHash, hammingDistance } from "./PerceptualHasher.js";

export class ImageChangeDetector {
	/**
	 * Detect visual change between two image blobs and classify severity.
	 *
	 * @param fromBuffer - Buffer of the old image, or null for ADDED files.
	 * @param toBuffer   - Buffer of the new image, or null for REMOVED files.
	 * @param filePath   - Repository-relative path (used for role heuristics).
	 * @param changeType - One of ADDED | REMOVED | MODIFIED.
	 */
	async detectChange(
		fromBuffer: Buffer | null,
		toBuffer: Buffer | null,
		filePath: string,
		changeType: Extract<ChangeType, "ADDED" | "REMOVED" | "MODIFIED">,
	): Promise<ImageDelta> {
		const role = classifyImageRole(filePath);

		if (changeType === "ADDED") {
			return { path: filePath, changeType: "ADDED", role, severity: severityForAdded(role), shaMatch: false };
		}

		if (changeType === "REMOVED") {
			return { path: filePath, changeType: "REMOVED", role, severity: severityForRemoved(role), shaMatch: false };
		}

		// MODIFIED: SHA gate → pHash gate → severity
		const fromHash = await computeImageHash(fromBuffer!);
		const toHash = await computeImageHash(toBuffer!);

		if (fromHash.sha256 === toHash.sha256) {
			return { path: filePath, changeType: "MODIFIED", role, severity: "COSMETIC", shaMatch: true };
		}

		let pHashDistance: number | undefined;
		if (fromHash.pHash !== undefined && toHash.pHash !== undefined) {
			pHashDistance = hammingDistance(fromHash.pHash, toHash.pHash);
		}

		const severity = classifySeverity(role, pHashDistance);
		return { path: filePath, changeType: "MODIFIED", role, severity, pHashDistance, shaMatch: false };
	}
}

function severityForAdded(role: ImageRole): Severity {
	if (role === "wireframe" || role === "diagram") return "BEHAVIORAL";
	return "INFORMATIONAL";
}

function severityForRemoved(role: ImageRole): Severity {
	if (role === "wireframe" || role === "diagram") return "BEHAVIORAL";
	return "INFORMATIONAL";
}

function classifySeverity(role: ImageRole, distance: number | undefined): Severity {
	if (distance === undefined) {
		// SHA differs but pHash unavailable — conservative per-role estimate
		return role === "wireframe" || role === "diagram" ? "BEHAVIORAL" : "INFORMATIONAL";
	}

	if (distance <= 3) return "COSMETIC";

	if (distance <= 15) {
		if (role === "icon_or_asset") return "COSMETIC";
		if (role === "wireframe" || role === "diagram" || role === "screenshot") return "BEHAVIORAL";
		return "INFORMATIONAL";
	}

	// distance >= 16 — major visual change
	if (role === "wireframe" || role === "diagram") return "BREAKING";
	return "BEHAVIORAL";
}

export {};
import { basename, dirname, extname } from "node:path";
import type { ImageDelta } from "../models/index.js";
import type { CorpusFileChange } from "./CorpusTreeDiffer.js";

export type CorrelationType = "explicit_ref" | "stem_match" | "same_dir" | "orphan";

export interface CorrelatedDelta {
	/** The text (markdown) file change, if any. */
	textChange?: CorpusFileChange;
	/** Image changes correlated with this text change (may be empty). */
	imageChanges: ImageDelta[];
	/** How the images were matched to the text, or "orphan" if unmatched. */
	correlationType: CorrelationType;
}

export class CrossAssetCorrelator {
	/**
	 * Group text and image changes into correlated deltas.
	 *
	 * Matching priority (applied in order, each image assigned at most once):
	 *   1. Explicit markdown reference  `![alt](./path/img.png)`
	 *   2. Filename stem match          `payment-flow.md` ↔ `payment-flow-v3.png`
	 *   3. Same directory
	 *   4. Orphan (no matching text change)
	 */
	correlate(textChanges: CorpusFileChange[], imageChanges: ImageDelta[]): CorrelatedDelta[] {
		const results: CorrelatedDelta[] = [];
		const assigned = new Set<string>();

		for (const textChange of textChanges) {
			const matchedImages: ImageDelta[] = [];
			let correlationType: CorrelationType = "orphan";

			// Strategy 1: image paths explicitly referenced in the markdown content
			const allContent = textChange.sectionChanges
				.flatMap((sc) => [sc.oldContent ?? "", sc.newContent ?? ""])
				.join("\n");
			const refs = extractImageRefs(allContent);

			for (const img of imageChanges) {
				if (assigned.has(img.path)) continue;
				if (refs.some((ref) => img.path.endsWith(ref) || ref.endsWith(img.path))) {
					matchedImages.push(img);
					assigned.add(img.path);
					correlationType = "explicit_ref";
				}
			}

			// Strategy 2: filename stem overlap
			const textStem = basename(textChange.path, extname(textChange.path)).toLowerCase();
			for (const img of imageChanges) {
				if (assigned.has(img.path)) continue;
				const imgStem = basename(img.path, extname(img.path)).toLowerCase();
				if (imgStem.includes(textStem) || textStem.includes(imgStem)) {
					matchedImages.push(img);
					assigned.add(img.path);
					if (correlationType !== "explicit_ref") correlationType = "stem_match";
				}
			}

			// Strategy 3: same directory
			const textDir = dirname(textChange.path);
			for (const img of imageChanges) {
				if (assigned.has(img.path)) continue;
				if (dirname(img.path) === textDir) {
					matchedImages.push(img);
					assigned.add(img.path);
					if (correlationType === "orphan") correlationType = "same_dir";
				}
			}

			results.push({
				textChange,
				imageChanges: matchedImages,
				correlationType: matchedImages.length > 0 ? correlationType : "orphan",
			});
		}

		// Remaining images with no matching text change
		for (const img of imageChanges) {
			if (!assigned.has(img.path)) {
				results.push({ imageChanges: [img], correlationType: "orphan" });
			}
		}

		return results;
	}
}

/** Extract image src paths from markdown `![alt](src)` syntax. */
function extractImageRefs(markdown: string): string[] {
	const refs: string[] = [];
	const re = /!\[.*?\]\(([^)]+)\)/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(markdown)) !== null) {
		// Strip optional title string: `![](path "title")` → `path`
		const raw = match[1].trim().split(/\s+/)[0];
		// Normalise leading ./ so endsWith checks work: ./images/x.png → images/x.png
		refs.push(raw.replace(/^\.\//, ""));
	}
	return refs;
}

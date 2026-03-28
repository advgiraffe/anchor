import { describe, it, expect } from "vitest";
import { classifyImageRole } from "../../../../src/core/diff/images/ImageRoleClassifier.js";
import {
	computeSha256,
	computeImageHash,
	hammingDistance,
} from "../../../../src/core/diff/images/PerceptualHasher.js";
import { ImageChangeDetector } from "../../../../src/core/diff/images/ImageChangeDetector.js";
import { CrossAssetCorrelator } from "../../../../src/core/diff/CrossAssetCorrelator.js";
import type { SectionChange } from "../../../../src/core/diff/text/SectionDiffer.js";
import type { CorpusFileChange } from "../../../../src/core/diff/CorpusTreeDiffer.js";

// ── ImageRoleClassifier ──────────────────────────────────────────────────────

describe("classifyImageRole", () => {
	it("detects wireframe by filename", () => {
		expect(classifyImageRole("docs/wireframe-checkout.png")).toBe("wireframe");
		expect(classifyImageRole("screens/mockup-home.png")).toBe("wireframe");
	});

	it("detects diagram by filename", () => {
		expect(classifyImageRole("docs/architecture-diagram.svg")).toBe("diagram");
		expect(classifyImageRole("flows/payment-flow.png")).toBe("diagram");
		expect(classifyImageRole("design/auth-uml.png")).toBe("diagram");
	});

	it("detects screenshot by filename", () => {
		expect(classifyImageRole("tests/screenshot-login.png")).toBe("screenshot");
		expect(classifyImageRole("docs/preview-dashboard.png")).toBe("screenshot");
	});

	it("detects icon_or_asset by filename", () => {
		expect(classifyImageRole("public/favicon.ico")).toBe("icon_or_asset");
		expect(classifyImageRole("src/app-logo.png")).toBe("icon_or_asset");
	});

	it("detects icon_or_asset by directory", () => {
		expect(classifyImageRole("assets/illustration.png")).toBe("icon_or_asset");
		expect(classifyImageRole("public/icons/arrow.svg")).toBe("icon_or_asset");
	});

	it("returns unknown for unrecognized paths", () => {
		expect(classifyImageRole("docs/banner.png")).toBe("unknown");
		expect(classifyImageRole("images/hero.jpg")).toBe("unknown");
	});
});

// ── PerceptualHasher ─────────────────────────────────────────────────────────

describe("computeSha256", () => {
	it("produces a 64-char hex string", () => {
		const buf = Buffer.from("hello world");
		const hash = computeSha256(buf);
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[0-9a-f]+$/);
	});

	it("produces different hashes for different content", () => {
		const a = computeSha256(Buffer.from("aaa"));
		const b = computeSha256(Buffer.from("bbb"));
		expect(a).not.toBe(b);
	});

	it("produces the same hash for identical content", () => {
		const content = Buffer.from("consistent");
		expect(computeSha256(content)).toBe(computeSha256(content));
	});
});

describe("computeImageHash", () => {
	it("always returns a sha256 even without sharp", async () => {
		const buf = Buffer.from("not-really-an-image");
		const result = await computeImageHash(buf);
		expect(result.sha256).toHaveLength(64);
		// pHash will be undefined because this is not a valid image (sharp absent or decode failure)
		// — both cases are acceptable
	});
});

describe("hammingDistance", () => {
	it("returns 0 for identical hashes", () => {
		expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
		expect(hammingDistance("ffffffffffffffff", "ffffffffffffffff")).toBe(0);
	});

	it("returns 64 for completely inverted hashes", () => {
		expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
	});

	it("counts differing bits correctly", () => {
		// 0x0 vs 0x1 = 1 bit difference, repeated 16 times → 16
		expect(hammingDistance("0000000000000000", "1111111111111111")).toBe(16);
		// 0x0 vs 0xf = 4 bits difference per nibble
		expect(hammingDistance("000f", "fff0")).toBe(4 + 4 + 4 + 4);
	});
});

// ── ImageChangeDetector ──────────────────────────────────────────────────────

describe("ImageChangeDetector", () => {
	const detector = new ImageChangeDetector();
	const dummyBuf = Buffer.from("fake-image-bytes");
	const dummyBuf2 = Buffer.from("different-image-bytes");

	it("classifies ADDED as INFORMATIONAL for unknown role", async () => {
		const delta = await detector.detectChange(null, dummyBuf, "images/hero.png", "ADDED");
		expect(delta.changeType).toBe("ADDED");
		expect(delta.severity).toBe("INFORMATIONAL");
		expect(delta.shaMatch).toBe(false);
	});

	it("classifies ADDED wireframe as BEHAVIORAL", async () => {
		const delta = await detector.detectChange(null, dummyBuf, "docs/wireframe-login.png", "ADDED");
		expect(delta.severity).toBe("BEHAVIORAL");
	});

	it("classifies REMOVED as INFORMATIONAL for unknown role", async () => {
		const delta = await detector.detectChange(dummyBuf, null, "images/hero.png", "REMOVED");
		expect(delta.changeType).toBe("REMOVED");
		expect(delta.severity).toBe("INFORMATIONAL");
	});

	it("returns COSMETIC with shaMatch=true for identical buffers", async () => {
		const delta = await detector.detectChange(dummyBuf, dummyBuf, "images/hero.png", "MODIFIED");
		expect(delta.severity).toBe("COSMETIC");
		expect(delta.shaMatch).toBe(true);
	});

	it("detects MODIFIED with different content (no sharp → conservative severity)", async () => {
		const delta = await detector.detectChange(dummyBuf, dummyBuf2, "docs/arch-diagram.png", "MODIFIED");
		expect(delta.changeType).toBe("MODIFIED");
		expect(delta.shaMatch).toBe(false);
		// Without sharp, role=diagram → BEHAVIORAL
		expect(delta.severity).toBe("BEHAVIORAL");
	});

	it("assigns correct path and role", async () => {
		const delta = await detector.detectChange(null, dummyBuf, "flows/payment-flow.png", "ADDED");
		expect(delta.path).toBe("flows/payment-flow.png");
		expect(delta.role).toBe("diagram");
	});
});

// ── CrossAssetCorrelator ─────────────────────────────────────────────────────

function makeTextChange(path: string, ...sectionContents: string[]): CorpusFileChange {
	const sectionChanges: SectionChange[] = sectionContents.map((content, i) => ({
		sectionId: `s${i}`,
		title: `Section ${i}`,
		changeType: "MODIFIED",
		oldContent: "",
		newContent: content,
	}));
	return { path, changeType: "MODIFIED", sectionChanges };
}

describe("CrossAssetCorrelator", () => {
	const correlator = new CrossAssetCorrelator();

	it("returns orphan correlations when no images", () => {
		const textChanges = [makeTextChange("docs/api.md")];
		const result = correlator.correlate(textChanges, []);
		expect(result).toHaveLength(1);
		expect(result[0].textChange?.path).toBe("docs/api.md");
		expect(result[0].imageChanges).toHaveLength(0);
		expect(result[0].correlationType).toBe("orphan");
	});

	it("correlates by explicit markdown image reference", () => {
		const textChange = makeTextChange(
			"docs/api.md",
			"See diagram: ![arch](./images/arch-diagram.png)"
		);
		const imageDelta = {
			path: "docs/images/arch-diagram.png",
			changeType: "MODIFIED" as const,
			role: "diagram" as const,
			severity: "BEHAVIORAL" as const,
			shaMatch: false,
		};
		const result = correlator.correlate([textChange], [imageDelta]);
		expect(result).toHaveLength(1);
		expect(result[0].imageChanges).toHaveLength(1);
		expect(result[0].correlationType).toBe("explicit_ref");
	});

	it("correlates by filename stem match", () => {
		const textChange = makeTextChange("docs/payment-flow.md", "Payment flow details");
		const imageDelta = {
			path: "assets/payment-flow-v2.png",
			changeType: "ADDED" as const,
			role: "diagram" as const,
			severity: "BEHAVIORAL" as const,
			shaMatch: false,
		};
		const result = correlator.correlate([textChange], [imageDelta]);
		expect(result).toHaveLength(1);
		expect(result[0].imageChanges).toHaveLength(1);
		expect(result[0].correlationType).toBe("stem_match");
	});

	it("correlates by same directory", () => {
		const textChange = makeTextChange("docs/overview.md", "Overview content");
		const imageDelta = {
			path: "docs/hero-banner.png",
			changeType: "MODIFIED" as const,
			role: "unknown" as const,
			severity: "INFORMATIONAL" as const,
			shaMatch: false,
		};
		const result = correlator.correlate([textChange], [imageDelta]);
		expect(result).toHaveLength(1);
		expect(result[0].imageChanges).toHaveLength(1);
		expect(result[0].correlationType).toBe("same_dir");
	});

	it("creates orphan entry for images with no matching text", () => {
		const imageDelta = {
			path: "assets/standalone-icon.png",
			changeType: "ADDED" as const,
			role: "icon_or_asset" as const,
			severity: "INFORMATIONAL" as const,
			shaMatch: false,
		};
		const result = correlator.correlate([], [imageDelta]);
		expect(result).toHaveLength(1);
		expect(result[0].textChange).toBeUndefined();
		expect(result[0].imageChanges[0].path).toBe("assets/standalone-icon.png");
		expect(result[0].correlationType).toBe("orphan");
	});

	it("does not assign same image to multiple text changes", () => {
		const t1 = makeTextChange("docs/page1.md", "content 1");
		const t2 = makeTextChange("docs/page1-extended.md", "content 2");
		const img = {
			path: "docs/page1-screenshot.png",
			changeType: "MODIFIED" as const,
			role: "screenshot" as const,
			severity: "BEHAVIORAL" as const,
			shaMatch: false,
		};
		const result = correlator.correlate([t1, t2], [img]);
		const totalImages = result.reduce((sum, r) => sum + r.imageChanges.length, 0);
		expect(totalImages).toBe(1);
	});
});

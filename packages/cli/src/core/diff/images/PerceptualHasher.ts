export {};
import { createHash } from "node:crypto";

export interface PHashResult {
	sha256: string;
	/** 16-char hex string encoding 64 bits; undefined when sharp is not installed. */
	pHash?: string;
}

export function computeSha256(buffer: Buffer): string {
	return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Compute SHA-256 and, when sharp is available, a 64-bit average perceptual hash.
 * Gracefully degrades to SHA-256 only if sharp is not installed or image decode fails.
 */
export async function computeImageHash(buffer: Buffer): Promise<PHashResult> {
	const sha256 = computeSha256(buffer);
	let pHash: string | undefined;

	try {
		// sharp is an optional peer dep — dynamic import so it fails gracefully
		// @ts-ignore -- sharp is an optional peer dependency not required at compile time
		const sharp = (await import("sharp")).default; // eslint-disable-line
		const { data } = await sharp(buffer)
			.resize(8, 8, { fit: "fill" })
			.grayscale()
			.raw()
			.toBuffer({ resolveWithObject: true });

		// Average hash (aHash): bit[i] = 1 if pixel[i] > mean(all pixels)
		const mean = (data as Buffer).reduce((sum, v) => sum + v, 0) / 64;
		let bits = 0n;
		for (let i = 0; i < 64; i++) {
			if ((data as Buffer)[i] > mean) bits |= 1n << BigInt(63 - i);
		}
		pHash = bits.toString(16).padStart(16, "0");
	} catch {
		// sharp unavailable or image decode failed — pHash remains undefined
	}

	return { sha256, pHash };
}

/**
 * Hamming distance between two 16-character hex pHash strings (64 bits each).
 * Returns the number of differing bits (0 = identical, 64 = completely different).
 */
export function hammingDistance(a: string, b: string): number {
	// Lookup table: popcount of 4-bit nibble values 0-15
	const pop4 = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
	let dist = 0;
	for (let i = 0; i < a.length; i++) {
		dist += pop4[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
	}
	return dist;
}

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export interface ExtractedItem {
	id: string;
	title: string;
	sourcePath: string;
	summary: string;
	metadata?: Record<string, string | number | boolean>;
}

export abstract class BaseExtractor {
	protected listFiles(root: string, extensions?: string[]): string[] {
		const resolvedRoot = resolve(root);
		const out: string[] = [];
		walk(resolvedRoot, resolvedRoot, out, extensions);
		return out.sort();
	}

	protected readTextFile(root: string, relativePath: string): string {
		const absolute = join(resolve(root), relativePath);
		return readFileSync(absolute, "utf8");
	}

	protected toId(prefix: string, value: string): string {
		const normalized = value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
		return `${prefix}-${normalized}`;
	}
}

function walk(root: string, current: string, out: string[], extensions?: string[]): void {
	for (const entry of readdirSync(current)) {
		if (entry === ".git" || entry === "node_modules" || entry === "dist" || entry === "coverage") {
			continue;
		}

		const absolute = join(current, entry);
		const stats = statSync(absolute);

		if (stats.isDirectory()) {
			walk(root, absolute, out, extensions);
			continue;
		}

		const rel = relative(root, absolute).replace(/\\/g, "/");
		if (!extensions || extensions.some((ext) => rel.toLowerCase().endsWith(ext))) {
			out.push(rel);
		}
	}
}

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { AnchorTargetConfig } from "../config/AnchorConfig.js";

export class TargetDetector {
	detect(sourcePath: string): AnchorTargetConfig[] {
		const root = resolve(sourcePath);
		const detectedNames = new Set<string>();

		const packageJson = this.readPackageJson(root);
		const allDeps = new Set<string>([
			...Object.keys(packageJson.dependencies ?? {}),
			...Object.keys(packageJson.devDependencies ?? {}),
		]);

		if (allDeps.has("react-native") || allDeps.has("expo")) {
			detectedNames.add("ios");
			detectedNames.add("android");
		}

		if (allDeps.has("jest") || allDeps.has("playwright") || allDeps.has("cypress")) {
			detectedNames.add("qa");
		}

		if (
			allDeps.has("prisma") ||
			allDeps.has("drizzle-orm") ||
			allDeps.has("typeorm") ||
			allDeps.has("mongoose")
		) {
			detectedNames.add("backend");
		}

		const scan = scanTree(root);

		if (scan.hasDirectory("ios") || scan.hasExtension(".swift")) {
			detectedNames.add("ios");
		}

		if (scan.hasDirectory("android") || scan.hasExtension(".kt")) {
			detectedNames.add("android");
		}

		if (scan.hasOpenApiLikeFile()) {
			detectedNames.add("api-consumer");
			detectedNames.add("backend");
		}

		if (scan.hasFile("prisma/schema.prisma")) {
			detectedNames.add("backend");
		}

		const detectedTargets = Array.from(detectedNames)
			.sort()
			.map((name) => DEFAULT_TARGETS[name])
			.filter((target): target is AnchorTargetConfig => Boolean(target));

		if (detectedTargets.length === 0) {
			return [DEFAULT_TARGETS.backend];
		}

		return detectedTargets;
	}

	private readPackageJson(root: string): {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	} {
		const packagePath = join(root, "package.json");
		if (!existsSync(packagePath)) {
			return {};
		}

		try {
			const raw = readFileSync(packagePath, "utf8");
			const parsed = JSON.parse(raw) as {
				dependencies?: Record<string, string>;
				devDependencies?: Record<string, string>;
			};
			return parsed;
		} catch {
			return {};
		}
	}
}

const DEFAULT_TARGETS: Record<string, AnchorTargetConfig> = {
	ios: {
		name: "ios",
		description: "iOS Swift/SwiftUI engineering agent",
		fileGlobs: ["**/*"],
		minSeverity: "BEHAVIORAL",
	},
	android: {
		name: "android",
		description: "Android Kotlin/Jetpack engineering agent",
		fileGlobs: ["**/*"],
		minSeverity: "BEHAVIORAL",
	},
	"api-consumer": {
		name: "api-consumer",
		description: "Frontend/API consumer agent",
		fileGlobs: ["api/**", "contracts/**", "**/*.yaml", "**/*.json"],
		minSeverity: "INFORMATIONAL",
	},
	qa: {
		name: "qa",
		description: "QA and test automation agent",
		fileGlobs: ["**/*"],
		minSeverity: "BEHAVIORAL",
	},
	backend: {
		name: "backend",
		description: "Backend/API implementation agent",
		fileGlobs: ["api/**", "schemas/**", "**/*.yaml"],
		minSeverity: "INFORMATIONAL",
	},
};

function scanTree(root: string): {
	hasDirectory: (dirName: string) => boolean;
	hasExtension: (extension: string) => boolean;
	hasOpenApiLikeFile: () => boolean;
	hasFile: (filePath: string) => boolean;
} {
	const directories = new Set<string>();
	const files = new Set<string>();

	walk(root, root, directories, files);

	return {
		hasDirectory: (dirName) => directories.has(dirName.toLowerCase()),
		hasExtension: (extension) => Array.from(files).some((file) => file.toLowerCase().endsWith(extension.toLowerCase())),
		hasOpenApiLikeFile: () =>
			Array.from(files).some((file) => {
				const lower = file.toLowerCase();
				return (
					lower.includes("openapi") ||
					lower.endsWith("/openapi.yaml") ||
					lower.endsWith("/openapi.yml") ||
					lower.endsWith("/openapi.json")
				);
			}),
		hasFile: (filePath) => files.has(filePath.replace(/\\/g, "/")),
	};
}

function walk(
	root: string,
	current: string,
	directories: Set<string>,
	files: Set<string>,
): void {
	for (const entry of readdirSync(current)) {
		if (entry === ".git" || entry === "node_modules") {
			continue;
		}

		const absolute = join(current, entry);
		const stats = statSync(absolute);

		if (stats.isDirectory()) {
			directories.add(entry.toLowerCase());
			walk(root, absolute, directories, files);
			continue;
		}

		const rel = relative(root, absolute).replace(/\\/g, "/");
		files.add(rel);
	}
}

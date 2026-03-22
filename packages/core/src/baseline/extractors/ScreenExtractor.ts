import { basename, dirname } from "node:path";
import { BaseExtractor, type ExtractedItem } from "./BaseExtractor.js";

export interface ExtractedScreen extends ExtractedItem {
	name: string;
	routeHint?: string;
	kind: "next-page" | "react-screen" | "component";
}

const SOURCE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];

export class ScreenExtractor extends BaseExtractor {
	extract(sourcePath: string): ExtractedScreen[] {
		const files = this.listFiles(sourcePath, SOURCE_EXTENSIONS);
		const screens: ExtractedScreen[] = [];

		for (const filePath of files) {
			const content = this.readTextFile(sourcePath, filePath);
			screens.push(...this.extractNextPages(filePath, content));
			screens.push(...this.extractReactScreens(filePath, content));
		}

		return dedupeScreens(screens);
	}

	private extractNextPages(filePath: string, content: string): ExtractedScreen[] {
		if (!/(^|\/)app\/.+\/page\.(tsx|jsx|ts|js)$/.test(filePath)) {
			return [];
		}
		if (!/export\s+default\s+function|export\s+default\s+\(/.test(content)) {
			return [];
		}

		const routeHint = deriveNextPageRoute(filePath);
		const routeName = routeHint === "/" ? "home" : routeHint.slice(1).replace(/\//g, "-");
		return [this.makeScreen(filePath, routeName, "next-page", routeHint)];
	}

	private extractReactScreens(filePath: string, content: string): ExtractedScreen[] {
		const lower = filePath.toLowerCase();
		const looksLikeScreenPath = lower.includes("/screens/") || lower.includes("/pages/");
		const componentName = inferComponentName(filePath, content);

		if (!componentName) {
			return [];
		}

		if (looksLikeScreenPath || componentName.endsWith("Screen") || componentName.endsWith("Page")) {
			return [this.makeScreen(filePath, componentName, "react-screen")];
		}

		if (lower.includes("/components/")) {
			return [this.makeScreen(filePath, componentName, "component")];
		}

		return [];
	}

	private makeScreen(
		sourcePath: string,
		name: string,
		kind: ExtractedScreen["kind"],
		routeHint?: string,
	): ExtractedScreen {
		const summary = routeHint
			? `${name} (${kind}) route: ${routeHint}`
			: `${name} (${kind})`;

		return {
			id: this.toId("screen", `${kind}-${name}`),
			title: name,
			sourcePath,
			name,
			kind,
			routeHint,
			summary,
			metadata: routeHint ? { kind, routeHint } : { kind },
		};
	}
}

function inferComponentName(filePath: string, content: string): string | undefined {
	const namedExportFn = content.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)/);
	if (namedExportFn?.[1]) return namedExportFn[1];

	const plainFn = content.match(/function\s+([A-Za-z0-9_]+)\s*\(/);
	if (plainFn?.[1]) return plainFn[1];

	const constComp = content.match(/const\s+([A-Za-z0-9_]+)\s*=\s*\(/);
	if (constComp?.[1]) return constComp[1];

	return basename(filePath).replace(/\.(tsx|jsx|ts|js)$/i, "");
}

function deriveNextPageRoute(filePath: string): string {
	const dir = dirname(filePath).replace(/\\/g, "/");
	const appToken = "/app/";
	const appIndex = dir.includes(appToken)
		? dir.indexOf(appToken)
		: dir.startsWith("app/")
			? -1
			: -2;

	if (appIndex === -2) {
		return "/";
	}
	const suffix = appIndex === -1 ? dir.slice(4) : dir.slice(appIndex + 5);
	const routeSegments = suffix
		.split("/")
		.filter((segment) => segment && !/^\(.*\)$/.test(segment));
	if (routeSegments.length === 0) {
		return "/";
	}
	return `/${routeSegments.join("/")}`;
}

function dedupeScreens(screens: ExtractedScreen[]): ExtractedScreen[] {
	const seen = new Set<string>();
	const out: ExtractedScreen[] = [];
	for (const screen of screens) {
		const key = `${screen.kind}:${screen.sourcePath}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(screen);
	}
	return out;
}

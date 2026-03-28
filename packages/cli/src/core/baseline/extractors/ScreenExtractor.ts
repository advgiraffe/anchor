import { basename, dirname } from "node:path";
import { BaseExtractor, type ExtractedItem } from "./BaseExtractor.js";

export interface ExtractedScreen extends ExtractedItem {
	name: string;
	routeHint?: string;
	kind: "next-page" | "react-screen" | "component" | "razor-page" | "razor-view" | "blazor-component";
}

const SOURCE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js", ".cshtml", ".razor"];

export class ScreenExtractor extends BaseExtractor {
	extract(sourcePath: string): ExtractedScreen[] {
		const files = this.listFiles(sourcePath, SOURCE_EXTENSIONS);
		const screens: ExtractedScreen[] = [];

		for (const filePath of files) {
			const content = this.readTextFile(sourcePath, filePath);
			screens.push(...this.extractNextPages(filePath, content));
			screens.push(...this.extractReactScreens(filePath, content));
			screens.push(...this.extractRazorPages(filePath, content));
			screens.push(...this.extractRazorViews(filePath));
			screens.push(...this.extractBlazorComponents(filePath, content));
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

	private extractRazorPages(filePath: string, content: string): ExtractedScreen[] {
		if (!filePath.toLowerCase().endsWith(".cshtml")) {
			return [];
		}

		const lower = filePath.toLowerCase();
		const inPagesDir = lower.includes("/pages/");
		const hasPageDirective = /(^|\s)@page(?:\s|$)/m.test(content);
		if (!inPagesDir && !hasPageDirective) {
			return [];
		}

		const routeHint = deriveRazorPageRoute(filePath, content);
		const name = buildRazorName(filePath);
		return [this.makeScreen(filePath, name, "razor-page", routeHint)];
	}

	private extractRazorViews(filePath: string): ExtractedScreen[] {
		if (!filePath.toLowerCase().endsWith(".cshtml")) {
			return [];
		}

		const normalized = filePath.replace(/\\/g, "/");
		const lower = normalized.toLowerCase();
		if (!lower.includes("/views/")) {
			return [];
		}

		const fileName = basename(normalized, ".cshtml");
		if (fileName.startsWith("_")) {
			return [];
		}

		const routeHint = deriveMvcViewRoute(normalized);
		const name = buildRazorName(normalized);
		return [this.makeScreen(filePath, name, "razor-view", routeHint)];
	}

	private extractBlazorComponents(filePath: string, content: string): ExtractedScreen[] {
		if (!filePath.toLowerCase().endsWith(".razor")) {
			return [];
		}

		const hasPageDirective = /(^|\s)@page\s+(?:@)?"([^"]+)"/m.exec(content);
		if (hasPageDirective) {
			const routeHint = normalizeRoutePath(hasPageDirective[2]);
			return [this.makeScreen(filePath, basename(filePath, ".razor"), "razor-page", routeHint)];
		}

		return [this.makeScreen(filePath, basename(filePath, ".razor"), "blazor-component")];
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

function deriveRazorPageRoute(filePath: string, content: string): string {
	const explicitTemplate = content.match(/@page\s+(?:@)?"([^"]+)"/m);
	if (explicitTemplate?.[1]) {
		return normalizeRoutePath(explicitTemplate[1]);
	}

	const normalized = filePath.replace(/\\/g, "/");
	const pageToken = "/pages/";
	const lower = normalized.toLowerCase();
	const pageIndex = lower.indexOf(pageToken);
	let pathPart = pageIndex >= 0 ? normalized.slice(pageIndex + pageToken.length) : normalized;
	pathPart = pathPart.replace(/\.cshtml$/i, "").replace(/^\/+/, "");
	if (pathPart.toLowerCase().endsWith("/index")) {
		pathPart = pathPart.slice(0, -"/index".length);
	}
	if (pathPart === "" || pathPart.toLowerCase() === "index") {
		return "/";
	}
	return `/${pathPart}`;
}

function deriveMvcViewRoute(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/");
	const viewToken = "/Views/";
	const viewIndex = normalized.indexOf(viewToken);
	if (viewIndex === -1) {
		return "/";
	}

	const suffix = normalized.slice(viewIndex + viewToken.length);
	const parts = suffix.split("/");
	if (parts.length < 2) {
		return "/";
	}

	const controller = parts[0];
	const action = basename(parts[parts.length - 1], ".cshtml");
	if (action.toLowerCase() === "index") {
		return normalizeRoutePath(`/${controller}`);
	}
	return normalizeRoutePath(`/${controller}/${action}`);
}

function buildRazorName(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/");
	return normalized
		.replace(/\.(cshtml|razor)$/i, "")
		.split("/")
		.slice(-2)
		.join("-")
		.replace(/[^A-Za-z0-9-]+/g, "")
		|| basename(filePath);
}

function normalizeRoutePath(path: string): string {
	if (!path) return "/";
	const trimmed = path.trim();
	if (trimmed === "") return "/";
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function dedupeScreens(screens: ExtractedScreen[]): ExtractedScreen[] {
	const seen = new Set<string>();
	const out: ExtractedScreen[] = [];
	for (const screen of screens) {
		const key = `${screen.kind}:${screen.sourcePath}:${screen.routeHint ?? ""}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(screen);
	}
	return out;
}

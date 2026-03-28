export {};
import { basename, dirname, extname } from "node:path";
import type { ImageRole } from "../../models/index.js";

const WIREFRAME_RE = /wireframe|wf[-_]|[-_]wf[-_]|mockup|mock[-_]up/i;
const DIAGRAM_RE = /diagram|flow|arch|erd|uml|chart|sequence|blueprint/i;
const SCREENSHOT_RE = /screen|capture|preview|snapshot|screenshot/i;
const ICON_NAME_RE = /icon|logo|badge|avatar|thumb|sprite|favicon/i;
const ICON_DIR_RE = /\bicons\b|\blogos\b|\bassets\b|\bsprites\b|\bthumbnails\b/i;

/**
 * Heuristically classify the role of an image from its file path.
 * No LLM calls — purely based on naming conventions and directory structure.
 */
export function classifyImageRole(filePath: string): ImageRole {
	const name = basename(filePath, extname(filePath));
	const dir = dirname(filePath);

	if (WIREFRAME_RE.test(name)) return "wireframe";
	if (DIAGRAM_RE.test(name)) return "diagram";
	if (SCREENSHOT_RE.test(name)) return "screenshot";
	if (ICON_NAME_RE.test(name) || ICON_DIR_RE.test(dir)) return "icon_or_asset";
	return "unknown";
}

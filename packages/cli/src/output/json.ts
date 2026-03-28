import type { AnchorResult } from "../core/index.js";

export function formatJson(result: AnchorResult): string {
	return `${JSON.stringify(result, null, 2)}\n`;
}

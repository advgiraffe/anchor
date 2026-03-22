import type { AnchorResult } from "@anchor_app/core";

export function formatJson(result: AnchorResult): string {
	return `${JSON.stringify(result, null, 2)}\n`;
}

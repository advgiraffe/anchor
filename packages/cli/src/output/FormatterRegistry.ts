import type { AnchorResult } from "@anchor_app/core";
import { formatInstructions } from "./instructions.js";
import { formatJson } from "./json.js";
import { formatMarkdown } from "./markdown.js";
import { formatSarif } from "./sarif.js";

export type OutputFormat = "json" | "markdown" | "sarif" | "instructions";

export type Formatter = (result: AnchorResult) => string;

const formatters: Record<OutputFormat, Formatter> = {
	json: formatJson,
	markdown: formatMarkdown,
	sarif: formatSarif,
	instructions: formatInstructions,
};

export function resolveFormatter(format: string): Formatter {
	const normalized = format.toLowerCase();
	if (!isOutputFormat(normalized)) {
		throw new Error(
			`Unsupported format '${format}'. Expected one of: ${Object.keys(formatters).join(", ")}`,
		);
	}
	return formatters[normalized];
}

export function isOutputFormat(value: string): value is OutputFormat {
	return value in formatters;
}

export function formatResult(result: AnchorResult, format: OutputFormat): string {
	return formatters[format](result);
}

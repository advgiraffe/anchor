import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { ConfigError } from "../errors/ConfigError.js";
import type { Severity } from "../models/index.js";
import type { AnchorConfig, AnchorTargetConfig } from "./AnchorConfig.js";

export class ConfigLoader {
	load(configPath = ".anchor.yaml", cwd = process.cwd()): AnchorConfig {
		const absolutePath = resolve(cwd, configPath);
		if (!existsSync(absolutePath)) {
			throw new ConfigError(`Config file not found at ${absolutePath}`);
		}

		const rawContent = readFileSync(absolutePath, "utf8");

		let parsed: unknown;
		try {
			parsed = parse(rawContent);
		} catch (error) {
			throw new ConfigError(
				`Failed to parse config at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		return validateAnchorConfig(parsed, absolutePath);
	}
}

function validateAnchorConfig(input: unknown, sourcePath: string): AnchorConfig {
	if (!isRecord(input)) {
		throw new ConfigError(`Config at ${sourcePath} must be a YAML object`);
	}

	const rawTargets = input.targets;
	if (!Array.isArray(rawTargets)) {
		throw new ConfigError(`Config at ${sourcePath} must contain a 'targets' array`);
	}

	const targets = rawTargets.map((target, index) => validateTarget(target, sourcePath, index));

	const config: AnchorConfig = {
		targets,
	};

	if (typeof input.version === "number") {
		config.version = input.version;
	}

	return config;
}

function validateTarget(input: unknown, sourcePath: string, index: number): AnchorTargetConfig {
	if (!isRecord(input)) {
		throw new ConfigError(`Target at index ${index} in ${sourcePath} must be an object`);
	}

	const name = input.name;
	if (typeof name !== "string" || name.trim().length === 0) {
		throw new ConfigError(`Target at index ${index} in ${sourcePath} must have a non-empty string 'name'`);
	}

	const fileGlobs = input.fileGlobs;
	if (!Array.isArray(fileGlobs) || !fileGlobs.every((glob) => typeof glob === "string")) {
		throw new ConfigError(
			`Target '${name}' in ${sourcePath} must have a string array 'fileGlobs'`,
		);
	}

	const target: AnchorTargetConfig = {
		name,
		fileGlobs,
	};

	const description = readOptionalString(input, "description");
	if (description) {
		target.description = description;
	}

	const excludeGlobs = readOptionalStringArray(input, "excludeGlobs");
	if (excludeGlobs) {
		target.excludeGlobs = excludeGlobs;
	}

	const sections = readOptionalStringArray(input, "sections");
	if (sections) {
		target.sections = sections;
	}

	const keywords = readOptionalStringArray(input, "keywords");
	if (keywords) {
		target.keywords = keywords;
	}

	const imageRoles = readOptionalStringArray(input, "imageRoles");
	if (imageRoles) {
		target.imageRoles = imageRoles;
	}

	const minSeverity = readOptionalSeverity(input, "minSeverity");
	if (minSeverity) {
		target.minSeverity = minSeverity;
	}

	return target;
}

function readOptionalString(input: Record<string, unknown>, key: string): string | undefined {
	const value = input[key];
	if (typeof value === "string") {
		return value;
	}
	return undefined;
}

function readOptionalStringArray(
	input: Record<string, unknown>,
	key: string,
): string[] | undefined {
	const value = input[key];
	if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
		return value;
	}
	return undefined;
}

function readOptionalSeverity(
	input: Record<string, unknown>,
	key: string,
): Severity | undefined {
	const value = readOptionalString(input, key);
	if (!value) {
		return undefined;
	}

	if (isSeverity(value)) {
		return value;
	}

	return undefined;
}

function isSeverity(value: string): value is Severity {
	return value === "BREAKING" || value === "BEHAVIORAL" || value === "INFORMATIONAL" || value === "COSMETIC";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

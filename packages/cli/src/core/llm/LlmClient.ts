export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5";
export const DEFAULT_ANTHROPIC_KEY_ENV_VARS = [
	"ANCHOR_ANTHROPIC_KEY",
	"ANTHROPIC_API_KEY",
] as const;
export const ANTHROPIC_KEY_ENV_OVERRIDE_VAR = "ANCHOR_ANTHROPIC_KEY_ENV_VAR";

export interface ProviderKeyResolution {
	apiKey: string;
	source: string;
	checkedEnvVars: string[];
}

export interface ResolveProviderKeyOptions {
	explicitApiKey?: string;
	explicitEnvVarName?: string;
}

export function resolveAnthropicApiKey(
	options: ResolveProviderKeyOptions = {},
): ProviderKeyResolution | null {
	if (options.explicitApiKey && options.explicitApiKey.trim().length > 0) {
		return {
			apiKey: options.explicitApiKey,
			source: "explicit apiKey parameter",
			checkedEnvVars: [],
		};
	}

	const checkedEnvVars = getAnthropicEnvVarCandidates(options.explicitEnvVarName);
	for (const envVarName of checkedEnvVars) {
		const value = process.env[envVarName];
		if (value && value.trim().length > 0) {
			return {
				apiKey: value,
				source: envVarName,
				checkedEnvVars,
			};
		}
	}

	return null;
}

export function getAnthropicEnvVarCandidates(explicitEnvVarName?: string): string[] {
	const candidates = new Set<string>();

	if (explicitEnvVarName && explicitEnvVarName.trim().length > 0) {
		candidates.add(explicitEnvVarName.trim());
	}

	const configuredEnvVarName = process.env[ANTHROPIC_KEY_ENV_OVERRIDE_VAR];
	if (configuredEnvVarName && configuredEnvVarName.trim().length > 0) {
		candidates.add(configuredEnvVarName.trim());
	}

	for (const envVarName of DEFAULT_ANTHROPIC_KEY_ENV_VARS) {
		candidates.add(envVarName);
	}

	return Array.from(candidates);
}

export function buildMissingAnthropicKeyMessage(explicitEnvVarName?: string): string {
	const checkedEnvVars = getAnthropicEnvVarCandidates(explicitEnvVarName);
	return [
		"No Anthropic API key was found for Anchor.",
		`Checked env vars: ${checkedEnvVars.join(", ")}.`,
		"Set ANCHOR_ANTHROPIC_KEY to isolate Anchor usage, or set ANTHROPIC_API_KEY to use the standard provider variable.",
		`You can also point Anchor at a custom variable name via ${ANTHROPIC_KEY_ENV_OVERRIDE_VAR}.`,
	].join(" ");
}

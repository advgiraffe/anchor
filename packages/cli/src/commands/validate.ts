import type { Command } from "commander";
import { resolve } from "node:path";
import { ConfigLoader } from "@anchor_app/core";

export interface ValidateCommandOptions {
  config: string;
  format: "text" | "json";
}

export interface ValidateDependencies {
  configLoader?: ConfigLoader;
  cwd?: string;
  emitOutput?: (output: string) => void;
}

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate Anchor configuration")
    .option("--config <path>", "Path to config file", ".anchor.yaml")
    .option("--format <format>", "Output format: text|json", "text")
    .action(async (opts: ValidateCommandOptions) => {
      const result = await validateAction(opts);
      if (!result.valid) {
        process.exitCode = 1;
      }
    });
}

export interface ValidateResult {
  valid: boolean;
  configPath: string;
  targetCount: number;
  message?: string;
}

export async function validateAction(
  opts: ValidateCommandOptions,
  dependencies: ValidateDependencies = {},
): Promise<ValidateResult> {
  const cwd = dependencies.cwd ?? process.cwd();
  const configPath = resolve(cwd, opts.config);
  const loader = dependencies.configLoader ?? new ConfigLoader();

  try {
    const config = loader.load(opts.config, cwd);
    const result: ValidateResult = {
      valid: true,
      configPath,
      targetCount: config.targets.length,
      message: "Config is valid",
    };
    emitValidateResult(result, opts.format, dependencies);
    return result;
  } catch (error) {
    const result: ValidateResult = {
      valid: false,
      configPath,
      targetCount: 0,
      message: error instanceof Error ? error.message : String(error),
    };
    emitValidateResult(result, opts.format, dependencies);
    return result;
  }
}

function emitValidateResult(
  result: ValidateResult,
  format: ValidateCommandOptions["format"],
  dependencies: ValidateDependencies,
): void {
  const output =
    format === "json"
      ? `${JSON.stringify(result, null, 2)}\n`
      : result.valid
        ? `OK config valid at ${result.configPath} (${result.targetCount} targets)\n`
        : `FAIL invalid config at ${result.configPath}: ${result.message}\n`;

  if (dependencies.emitOutput) {
    dependencies.emitOutput(output);
    return;
  }

  process.stdout.write(output);
}

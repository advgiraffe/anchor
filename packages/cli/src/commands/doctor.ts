import { spawnSync } from "node:child_process";
import type { Command } from "commander";
import {
  ANTHROPIC_KEY_ENV_OVERRIDE_VAR,
  getAnthropicEnvVarCandidates,
  resolveAnthropicApiKey,
} from "@anchor_app/core";

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "fail";
  message: string;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Verify local Anchor runtime prerequisites")
    .action(() => {
      const checks = runChecks();

      for (const check of checks) {
        const marker = check.status === "ok" ? "OK" : check.status === "warn" ? "WARN" : "FAIL";
        console.log(`${marker} ${check.name}: ${check.message}`);
      }

      const failures = checks.filter((check) => check.status === "fail");
      if (failures.length > 0) {
        process.exitCode = 1;
      }
    });
}

function runChecks(): CheckResult[] {
  const results: CheckResult[] = [];

  results.push({
    name: "node",
    status: "ok",
    message: process.version,
  });

  const gitVersion = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (gitVersion.status === 0) {
    results.push({
      name: "git",
      status: "ok",
      message: gitVersion.stdout.trim(),
    });
  } else {
    results.push({
      name: "git",
      status: "fail",
      message: "git not found in PATH",
    });
  }

  const inRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  if (inRepo.status === 0 && inRepo.stdout.trim() === "true") {
    results.push({
      name: "repository",
      status: "ok",
      message: "current directory is a git worktree",
    });
  } else {
    results.push({
      name: "repository",
      status: "warn",
      message: "current directory is not a git worktree",
    });
  }

  const anthropicKey = resolveAnthropicApiKey();
  if (anthropicKey) {
    results.push({
      name: "anthropic_key",
      status: "ok",
      message: `${anthropicKey.source} is set`,
    });
  } else {
    const checked = getAnthropicEnvVarCandidates();
    results.push({
      name: "anthropic_key",
      status: "warn",
      message: `missing. Checked ${checked.join(", ")}. Set ANCHOR_ANTHROPIC_KEY or ANTHROPIC_API_KEY. Override with ${ANTHROPIC_KEY_ENV_OVERRIDE_VAR} if needed.`,
    });
  }

  return results;
}

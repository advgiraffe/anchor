import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate Anchor configuration file presence")
    .option("--config <path>", "Path to config file", ".anchor.yaml")
    .action((opts: { config: string }) => {
      const configPath = resolve(process.cwd(), opts.config);
      const exists = existsSync(configPath);

      if (exists) {
        console.log(`OK config found at ${configPath}`);
        return;
      }

      console.error(`FAIL config not found at ${configPath}`);
      process.exitCode = 1;
    });
}

import type { Command } from "commander";

export function registerNotImplemented(
  program: Command,
  name: string,
  description: string,
): void {
  program
    .command(name)
    .description(description)
    .action(() => {
      console.error(`command '${name}' is not implemented yet`);
      process.exitCode = 1;
    });
}

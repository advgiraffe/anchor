import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

export interface TempGitRepo {
  dir: string;
  cleanup: () => void;
  commitFile: (relativePath: string, content: string, message: string) => string;
}

export function createTempGitRepo(): TempGitRepo {
  const dir = mkdtempSync(join(tmpdir(), "anchor-git-test-"));

  runGit(dir, ["init"]);
  runGit(dir, ["config", "user.name", "Anchor Test"]);
  runGit(dir, ["config", "user.email", "anchor-test@example.com"]);

  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
    commitFile: (relativePath: string, content: string, message: string) => {
      const filePath = join(dir, relativePath);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, "utf8");
      runGit(dir, ["add", relativePath]);
      runGit(dir, ["commit", "-m", message]);
      return runGit(dir, ["rev-parse", "HEAD"]).trim();
    },
  };
}

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawnSync } from "node:child_process";
import { AnchorError } from "../errors/AnchorError.js";

export class GitExtractor {
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
  }

  /**
   * Extract file content from a git ref (commit/branch)
   */
  async extractFileAtRef(ref: string, filePath: string): Promise<string> {
    try {
      const result = spawnSync("git", ["show", `${ref}:${filePath}`], {
        cwd: this.repoPath,
        encoding: "utf8",
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        const stderr = result.stderr || "";
        if (stderr.includes("fatal")) {
          throw new AnchorError(
            "GIT_FILE_NOT_FOUND",
            `File '${filePath}' not found at ref '${ref}'`,
            { ref, filePath, stderr }
          );
        }
        throw new Error(stderr);
      }

      return result.stdout;
    } catch (error) {
      if (error instanceof AnchorError) {
        throw error;
      }
      throw new AnchorError(
        "GIT_EXTRACT_FAILED",
        `Failed to extract '${filePath}' from '${ref}': ${error instanceof Error ? error.message : String(error)}`,
        { ref, filePath }
      );
    }
  }

  /**
   * Verify that a ref exists
   */
  async refExists(ref: string): Promise<boolean> {
    const result = spawnSync("git", ["rev-parse", "--verify", ref], {
      cwd: this.repoPath,
    });
    return result.status === 0;
  }

  /**
   * Resolve a ref to its full commit SHA
   */
  async resolveRef(ref: string): Promise<string> {
    try {
      const result = spawnSync("git", ["rev-parse", ref], {
        cwd: this.repoPath,
        encoding: "utf8",
      });

      if (result.status !== 0) {
        throw new Error(result.stderr || "Unknown error");
      }

      return result.stdout.trim();
    } catch (error) {
      throw new AnchorError(
        "GIT_REF_RESOLUTION_FAILED",
        `Failed to resolve ref '${ref}': ${error instanceof Error ? error.message : String(error)}`,
        { ref }
      );
    }
  }
}

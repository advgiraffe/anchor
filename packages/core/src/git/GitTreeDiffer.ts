import { spawnSync } from "node:child_process";
import type { ChangeType } from "../models/index.js";
import { AnchorError } from "../errors/AnchorError.js";

export interface GitTreeChange {
	path: string;
	changeType: Extract<ChangeType, "ADDED" | "REMOVED" | "MODIFIED" | "RENAMED">;
	oldPath?: string;
}

export class GitTreeDiffer {
	private readonly repoPath: string;

	constructor(repoPath: string = process.cwd()) {
		this.repoPath = repoPath;
	}

	async diff(
		fromRef: string,
		toRef: string,
		scopedPath?: string,
	): Promise<GitTreeChange[]> {
		const args = ["diff", "--name-status", "--find-renames", fromRef, toRef];
		if (scopedPath) {
			args.push("--", scopedPath);
		}

		const result = spawnSync("git", args, {
			cwd: this.repoPath,
			encoding: "utf8",
		});

		if (result.error) {
			throw new AnchorError(
				"GIT_TREE_DIFF_FAILED",
				`Failed to diff git tree: ${result.error.message}`,
				{ fromRef, toRef, scopedPath },
			);
		}

		if (result.status !== 0) {
			throw new AnchorError(
				"GIT_TREE_DIFF_FAILED",
				`Failed to diff git tree: ${result.stderr || result.stdout || "unknown git error"}`,
				{ fromRef, toRef, scopedPath },
			);
		}

		const changes: GitTreeChange[] = [];
		const lines = result.stdout
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		for (const line of lines) {
			const parts = line.split("\t");
			const status = parts[0] ?? "";

			if (status.startsWith("R")) {
				const oldPath = parts[1];
				const newPath = parts[2];
				if (oldPath && newPath) {
					changes.push({
						path: newPath,
						oldPath,
						changeType: "RENAMED",
					});
				}
				continue;
			}

			const path = parts[1];
			if (!path) {
				continue;
			}

			if (status === "A") {
				changes.push({ path, changeType: "ADDED" });
			} else if (status === "D") {
				changes.push({ path, changeType: "REMOVED" });
			} else {
				changes.push({ path, changeType: "MODIFIED" });
			}
		}

		return changes;
	}
}

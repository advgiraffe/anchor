import { AnchorError } from "./AnchorError.js";

export class GitError extends AnchorError {
	public constructor(message: string, details?: unknown) {
		super("GIT_ERROR", message, details);
		this.name = "GitError";
	}
}

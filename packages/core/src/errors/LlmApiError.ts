import { AnchorError } from "./AnchorError.js";

export class LlmApiError extends AnchorError {
	public constructor(message: string, details?: unknown) {
		super("LLM_API_ERROR", message, details);
		this.name = "LlmApiError";
	}
}

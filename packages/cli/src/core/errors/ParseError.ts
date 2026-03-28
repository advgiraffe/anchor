import { AnchorError } from "./AnchorError.js";

export class ParseError extends AnchorError {
	public constructor(message: string, details?: unknown) {
		super("PARSE_ERROR", message, details);
		this.name = "ParseError";
	}
}

import { AnchorError } from "./AnchorError.js";

export class ConfigError extends AnchorError {
	public constructor(message: string, details?: unknown) {
		super("CONFIG_ERROR", message, details);
		this.name = "ConfigError";
	}
}

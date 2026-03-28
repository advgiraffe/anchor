export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
	debug(message: string, fields?: Record<string, unknown>): void;
	info(message: string, fields?: Record<string, unknown>): void;
	warn(message: string, fields?: Record<string, unknown>): void;
	error(message: string, fields?: Record<string, unknown>): void;
}

export class ConsoleLogger implements Logger {
	private readonly minLevel: LogLevel;

	public constructor(minLevel: LogLevel = "info") {
		this.minLevel = minLevel;
	}

	public debug(message: string, fields?: Record<string, unknown>): void {
		this.log("debug", message, fields);
	}

	public info(message: string, fields?: Record<string, unknown>): void {
		this.log("info", message, fields);
	}

	public warn(message: string, fields?: Record<string, unknown>): void {
		this.log("warn", message, fields);
	}

	public error(message: string, fields?: Record<string, unknown>): void {
		this.log("error", message, fields);
	}

	private log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
		if (this.levelValue(level) < this.levelValue(this.minLevel)) {
			return;
		}

		const prefix = `[${level.toUpperCase()}]`;
		if (fields && Object.keys(fields).length > 0) {
			console.log(prefix, message, fields);
			return;
		}

		console.log(prefix, message);
	}

	private levelValue(level: LogLevel): number {
		switch (level) {
			case "debug":
				return 10;
			case "info":
				return 20;
			case "warn":
				return 30;
			case "error":
				return 40;
			default:
				return 100;
		}
	}
}

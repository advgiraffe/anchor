export class GlobMatcher {
	matches(path: string, pattern: string): boolean {
		const normalizedPath = normalizePath(path);
		const normalizedPattern = normalizePath(pattern);
		const regex = new RegExp(globToRegex(normalizedPattern));
		return regex.test(normalizedPath);
	}

	matchesAny(path: string, patterns: string[]): boolean {
		if (patterns.length === 0) {
			return false;
		}
		return patterns.some((pattern) => this.matches(path, pattern));
	}
}

function normalizePath(input: string): string {
	return input.replace(/\\+/g, "/").replace(/^\.\//, "");
}

function globToRegex(glob: string): string {
	const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");

	const withGlobstars = escaped.replace(/\*\*/g, "___GLOBSTAR___");
	const withStars = withGlobstars.replace(/\*/g, "[^/]*");
	const withQuestions = withStars.replace(/\?/g, "[^/]");
	const restoredGlobstars = withQuestions.replace(/___GLOBSTAR___/g, ".*");

	return `^${restoredGlobstars}$`;
}

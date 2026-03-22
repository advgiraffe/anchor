export * from "./models/index.js";
export * from "./errors/AnchorError.js";
export * from "./errors/GitError.js";
export * from "./errors/LlmApiError.js";
export * from "./errors/ConfigError.js";
export * from "./errors/ParseError.js";
export * from "./logger/Logger.js";
export * from "./llm/LlmClient.js";

// Phase 1A: Single-file markdown diff
export { GitExtractor } from "./git/GitExtractor.js";
export { GitTreeDiffer, type GitTreeChange } from "./git/GitTreeDiffer.js";
export { MarkdownParser, type ParsedSection } from "./diff/text/parsers/MarkdownParser.js";
export { SectionDiffer, type SectionChange } from "./diff/text/SectionDiffer.js";
export {
	CorpusTreeDiffer,
	type CorpusFileChange,
	type CorpusTreeDifferDependencies,
} from "./diff/CorpusTreeDiffer.js";
export { GlobMatcher, TargetRouter, type RouteTarget, type TargetRoute } from "./routing/index.js";
export { InstructionGenerator, type TargetInstruction } from "./llm/index.js";
export { AnthropicClient, type LlmResponse, type LlmMessage } from "./llm/providers/AnthropicClient.js";
export { SectionClassifier, type ClassificationResult } from "./llm/SectionClassifier.js";

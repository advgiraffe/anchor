import type { Command } from "commander";
import {
  GitExtractor,
  MarkdownParser,
  SectionDiffer,
  SectionClassifier,
  type FileDelta,
  type AnchorResult,
  ConsoleLogger,
  type Severity,
} from "@anchor-ai/core";

export interface CompareCommandOptions {
  from: string;
  to: string;
  file?: string;
  corpus?: string;
}

export interface CompareClassifier {
  classifyChange(
    title: string,
    oldContent: string | undefined,
    newContent: string | undefined,
    changeType: "ADDED" | "REMOVED" | "MODIFIED",
  ): Promise<{ severity: Severity; summary: string; reasoning: string }>;
}

export interface CompareDependencies {
  gitExtractor?: GitExtractor;
  parser?: MarkdownParser;
  differ?: SectionDiffer;
  classifier?: CompareClassifier;
  logger?: ConsoleLogger;
  emitResult?: (result: AnchorResult) => void;
  repoPath?: string;
}

export function registerCompareCommand(program: Command): void {
  program
    .command("compare")
    .description("Compare requirements/spec changes between refs")
    .option("--from <ref>", "Start git ref", "HEAD~1")
    .option("--to <ref>", "End git ref", "HEAD")
    .option("--file <path>", "Single file path to compare")
    .option("--corpus <path>", "Corpus path to compare")
    .action(async (opts: CompareCommandOptions) => {
      try {
        await compareAction(opts);
      } catch (error) {
        console.error(
          `compare error: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exitCode = 1;
      }
    });
}

export async function compareAction(
  opts: CompareCommandOptions,
  dependencies: CompareDependencies = {},
): Promise<AnchorResult> {
  const logger = dependencies.logger ?? new ConsoleLogger("info");

  // Validate arguments
  if (!opts.file && !opts.corpus) {
    throw new Error(
      "Either --file or --corpus must be specified to compare"
    );
  }

  if (opts.file && opts.corpus) {
    throw new Error("Cannot specify both --file and --corpus");
  }

  // For Phase 1A, only support single file mode
  if (!opts.file) {
    throw new Error(
      "Phase 1A only supports --file mode. Multi-file corpus coming in Phase 1B"
    );
  }

  logger.info(`Comparing ${opts.file} from ${opts.from} to ${opts.to}`);

  // Extract file content from both refs
  const git = dependencies.gitExtractor ?? new GitExtractor(dependencies.repoPath ?? process.cwd());
  logger.info("Extracting file contents from git refs...");

  const oldContent = await git.extractFileAtRef(opts.from, opts.file);
  const newContent = await git.extractFileAtRef(opts.to, opts.file);

  // Parse into sections
  logger.info("Parsing markdown sections...");
  const parser = dependencies.parser ?? new MarkdownParser();
  const oldSections = parser.parse(oldContent);
  const newSections = parser.parse(newContent);

  logger.info(`Found ${oldSections.length} old sections, ${newSections.length} new sections`);

  // Detect section changes
  logger.info("Detecting section changes...");
  const differ = dependencies.differ ?? new SectionDiffer();
  const sectionChanges = differ.diff(oldSections, newSections);

  logger.info(`Found ${sectionChanges.length} section changes`);

  // Classify changes using LLM
  logger.info("Classifying changes with LLM...");
  const classifier = dependencies.classifier ?? new SectionClassifier();

  const result: AnchorResult = {
    metadata: {
      path: opts.file,
      fromRef: opts.from,
      toRef: opts.to,
      generatedAt: new Date().toISOString(),
      totalFilesChanged: 1,
    },
    fileDeltas: [],
  };

  const fileDelta: FileDelta = {
    path: opts.file,
    changeType: "MODIFIED",
    sectionDeltas: [],
    maxSeverity: "COSMETIC",
  };

  for (const change of sectionChanges) {
    logger.info(`Classifying section: ${change.title}`);

    // Only classify allowed change types
    const classifiableChangeType: "ADDED" | "REMOVED" | "MODIFIED" = 
      change.changeType === "ADDED" ? "ADDED" :
      change.changeType === "REMOVED" ? "REMOVED" :
      "MODIFIED";

    const classification = await classifier.classifyChange(
      change.title,
      change.oldContent,
      change.newContent,
      classifiableChangeType
    );

    fileDelta.sectionDeltas.push({
      sectionId: change.sectionId,
      title: change.title,
      changeType: change.changeType,
      severity: classification.severity,
      summary: classification.summary,
    });

    // Update max severity
    const severityOrder: Record<string, number> = {
      BREAKING: 4,
      BEHAVIORAL: 3,
      INFORMATIONAL: 2,
      COSMETIC: 1,
    };

    if (
      severityOrder[classification.severity] >
      severityOrder[fileDelta.maxSeverity]
    ) {
      fileDelta.maxSeverity = classification.severity;
    }
  }

  result.fileDeltas.push(fileDelta);

  if (dependencies.emitResult) {
    dependencies.emitResult(result);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  return result;
}

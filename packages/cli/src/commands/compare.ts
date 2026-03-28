import type { Command } from "commander";
import { writeFileSync } from "node:fs";
import {
  ConfigLoader,
  GitExtractor,
  GitTreeDiffer,
  MarkdownParser,
  SectionDiffer,
  SectionClassifier,
  CorpusTreeDiffer,
  TargetRouter,
  InstructionGenerator,
  type AnchorTargetConfig,
  type CorpusFileChange,
  type FileDelta,
  type AnchorResult,
  ConsoleLogger,
  type Logger,
  type Severity,
} from "../core/index.js";
import { resolveFormatter, type OutputFormat } from "../output/FormatterRegistry.js";

export interface CompareCommandOptions {
  from: string;
  to: string;
  file?: string;
  corpus?: string;
  format?: OutputFormat;
  config?: string;
  targets?: string;
  output?: string;
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
  gitTreeDiffer?: GitTreeDiffer;
  corpusDiffer?: CorpusTreeDiffer;
  configLoader?: ConfigLoader;
  parser?: MarkdownParser;
  differ?: SectionDiffer;
  classifier?: CompareClassifier;
  logger?: Logger;
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
    .option("--format <format>", "Output format: json|markdown|sarif|instructions", "json")
    .option("--config <path>", "Path to config file for target-aware instructions", ".anchor.yaml")
    .option("--targets <names>", "Comma-separated target names (instructions format only)")
    .option("--output <path>", "Write output to file instead of stdout")
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
  const logger: Logger = dependencies.logger ?? new ConsoleLogger("info");

  // Validate arguments
  if (!opts.file && !opts.corpus) {
    throw new Error(
      "Either --file or --corpus must be specified to compare"
    );
  }

  if (opts.file && opts.corpus) {
    throw new Error("Cannot specify both --file and --corpus");
  }

  const classifier = dependencies.classifier ?? new SectionClassifier();

  if (opts.file) {
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

    const fileDelta = await classifyFileChanges(
      {
        path: opts.file,
        changeType: "MODIFIED",
        sectionChanges,
      },
      classifier,
      logger,
    );

    const result: AnchorResult = {
      metadata: {
        path: opts.file,
        fromRef: opts.from,
        toRef: opts.to,
        generatedAt: new Date().toISOString(),
        totalFilesChanged: 1,
      },
      fileDeltas: [fileDelta],
    };

    emitCompareResult(result, opts, dependencies, logger);

    return result;
  }

  logger.info(`Comparing corpus ${opts.corpus} from ${opts.from} to ${opts.to}`);

  const corpusDiffer =
    dependencies.corpusDiffer ??
    new CorpusTreeDiffer({
      repoPath: dependencies.repoPath,
      gitExtractor: dependencies.gitExtractor,
      gitTreeDiffer: dependencies.gitTreeDiffer,
      parser: dependencies.parser,
      differ: dependencies.differ,
    });

  const { fileChanges: corpusChanges, imageChanges } = await corpusDiffer.diff(opts.from, opts.to, opts.corpus!);
  logger.info(`Found ${corpusChanges.length} changed files, ${imageChanges.length} changed images in corpus`);

  const result: AnchorResult = {
    metadata: {
      path: opts.corpus!,
      fromRef: opts.from,
      toRef: opts.to,
      generatedAt: new Date().toISOString(),
      totalFilesChanged: 0,
    },
    fileDeltas: [],
  };

  for (const change of corpusChanges) {
    const fileDelta = await classifyFileChanges(change, classifier, logger);
    result.fileDeltas.push(fileDelta);
  }

  result.metadata.totalFilesChanged = result.fileDeltas.length;

  emitCompareResult(result, opts, dependencies, logger);

  return result;
}

function emitCompareResult(
  result: AnchorResult,
  opts: Pick<CompareCommandOptions, "format" | "output" | "config" | "targets">,
  dependencies: CompareDependencies,
  logger: Logger,
): void {
  if (dependencies.emitResult) {
    dependencies.emitResult(result);
    return;
  }

  let rendered: string;

  if ((opts.format ?? "json") === "instructions") {
    rendered = renderTargetInstructions(result, opts, dependencies, logger);
  } else {
    const formatter = resolveFormatter(opts.format ?? "json");
    rendered = formatter(result);
  }

  if (opts.output) {
    writeFileSync(opts.output, rendered, "utf8");
    return;
  }

  process.stdout.write(rendered);
}

function renderTargetInstructions(
  result: AnchorResult,
  opts: Pick<CompareCommandOptions, "config" | "targets">,
  dependencies: CompareDependencies,
  logger: Logger,
): string {
  try {
    const loader = dependencies.configLoader ?? new ConfigLoader();
    const config = loader.load(opts.config ?? ".anchor.yaml", dependencies.repoPath ?? process.cwd());

    let selectedTargets = config.targets;
    const requestedTargets = parseRequestedTargets(opts.targets);

    if (requestedTargets.length > 0) {
      const requestedSet = new Set(requestedTargets);
      selectedTargets = config.targets.filter((target) => requestedSet.has(target.name));
      if (selectedTargets.length === 0) {
        throw new Error(`No configured targets matched requested list: ${requestedTargets.join(", ")}`);
      }
    }

    const router = new TargetRouter();
    const routes = router.route(result, selectedTargets.map(mapToRouteTarget));
    const generator = new InstructionGenerator();
    const instructions = generator.generate(routes);

    if (instructions.length === 0) {
      return "Anchor change instructions\n\nNo action needed: no target-mapped deltas detected.\n";
    }

    const lines: string[] = [];
    lines.push("Anchor change instructions");
    lines.push("");
    lines.push(`Scope: ${result.metadata.path}`);
    lines.push(`Refs: ${result.metadata.fromRef} -> ${result.metadata.toRef}`);
    lines.push(`Files changed: ${result.metadata.totalFilesChanged}`);
    lines.push("");

    for (const instruction of instructions) {
      lines.push(instruction.instruction.trimEnd());
      lines.push("");
    }

    return `${lines.join("\n")}\n`;
  } catch (error) {
    logger.warn(
      `Falling back to default instructions formatter: ${error instanceof Error ? error.message : String(error)}`,
    );
    const formatter = resolveFormatter("instructions");
    return formatter(result);
  }
}

function parseRequestedTargets(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function mapToRouteTarget(target: AnchorTargetConfig): {
  id: string;
  description?: string;
  include: string[];
  exclude?: string[];
} {
  return {
    id: target.name,
    description: target.description,
    include: target.fileGlobs,
    exclude: target.excludeGlobs,
  };
}

async function classifyFileChanges(
  fileChange: Pick<CorpusFileChange, "path" | "changeType" | "sectionChanges">,
  classifier: CompareClassifier,
  logger: Logger,
): Promise<FileDelta> {
  const fileDelta: FileDelta = {
    path: fileChange.path,
    changeType: fileChange.changeType,
    sectionDeltas: [],
    maxSeverity: defaultFileSeverity(fileChange.changeType),
  };

  for (const change of fileChange.sectionChanges) {
    logger.info(`Classifying section: ${change.title}`);

    const classifiableChangeType: "ADDED" | "REMOVED" | "MODIFIED" =
      change.changeType === "ADDED"
        ? "ADDED"
        : change.changeType === "REMOVED"
          ? "REMOVED"
          : "MODIFIED";

    const classification = await classifier.classifyChange(
      change.title,
      change.oldContent,
      change.newContent,
      classifiableChangeType,
    );

    fileDelta.sectionDeltas.push({
      sectionId: change.sectionId,
      title: change.title,
      changeType: change.changeType,
      severity: classification.severity,
      summary: classification.summary,
    });

    if (severityOrder[classification.severity] > severityOrder[fileDelta.maxSeverity]) {
      fileDelta.maxSeverity = classification.severity;
    }
  }

  return fileDelta;
}

const severityOrder: Record<Severity, number> = {
  BREAKING: 4,
  BEHAVIORAL: 3,
  INFORMATIONAL: 2,
  COSMETIC: 1,
};

function defaultFileSeverity(changeType: FileDelta["changeType"]): Severity {
  if (changeType === "ADDED" || changeType === "REMOVED" || changeType === "RENAMED") {
    return "INFORMATIONAL";
  }
  return "COSMETIC";
}

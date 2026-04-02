import path from "path";

import { BuildConfigFileLoader, DEFAULT_BUILD_CONFIG_FILE } from "./buildConfigFile";
import { cleanConfig } from "./configCleaner";
import { loadConfigFile } from "./configLoader";
import { serializeConfig } from "./configSerializer";
import { DiffEngine } from "./diffEngine";
import { isValidEnvVarName } from "./envVar";
import { FileWriter } from "./fileWriter";
import { DiffFormatter } from "./formatter";
import { PathNormalizer } from "./pathNormalizer";
import type { DiffOptions, DumpMetadata, FileOutput, ResolvedDumpBuild } from "./types";

type DiffOutputFormat = "detailed" | "summary" | "json" | "yaml" | "markdown";
type DumpOutputFormat = "yaml" | "json" | "inspect";

interface ParsedDiffArgs {
  left?: string;
  right?: string;
  mode: string;
  format: DiffOutputFormat;
  output?: string;
  includeUnchanged: boolean;
  pluginAware: boolean;
  matchRulesByTest: boolean;
  maxDepth: number | null;
  ignoreKeys: string[];
  ignorePaths: string[];
  normalizePaths: boolean;
  pathSeparator: string;
  help: boolean;
}

interface ParsedDumpArgs {
  configFile?: string;
  format: DumpOutputFormat;
  output?: string;
  saveDir?: string;
  annotate: boolean;
  bundler?: "webpack" | "rspack";
  mode: string;
  environment?: string;
  configType?: string;
  appRoot: string;
  env: string[];
  clean: boolean;
  warnSensitive: boolean;
  build?: string;
  allBuilds: boolean;
  listBuilds: boolean;
  buildConfigFile: string;
  help: boolean;
}

interface OptionToken {
  name: string;
  inlineValue?: string;
}

interface SplitDumpOptions {
  bundler: string;
  environment: string;
  buildName?: string;
  outputs: string[];
  fallbackConfigType: string;
  parsed: ParsedDumpArgs;
}

const DEFAULT_DUMP_SAVE_DIR = "pack-config-diff-exports";

const HELP_TEXT = `pack-config-diff — Semantic config tooling for webpack and rspack

Commands:
  diff                          Compare two config files (default command)
  dump                          Load and serialize a live config file

Usage:
  pack-config-diff diff --left=<file1> --right=<file2> [options]
  pack-config-diff --left=<file1> --right=<file2> [options]
  pack-config-diff dump <config-file> [options]

Diff Required Options:
  --left=<file>                 Path to the first (left) config file
  --right=<file>                Path to the second (right) config file

Diff Output Options:
  --format=<format>             detailed, summary, json, yaml, markdown (default: detailed)
  --output=<file>               Write diff output to file instead of stdout

Diff Comparison Options:
  --include-unchanged           Include unchanged values in output
  --max-depth=<number>          Maximum depth for comparison (default: unlimited)
  --ignore-keys=<keys>          Comma-separated list of keys to ignore
  --ignore-paths=<paths>        Comma-separated list of paths to ignore (supports wildcards)
  --plugin-aware                Compare class-instance plugins by constructor + options
  --match-rules-by-test         Match module.rules entries by rule test instead of index
  --no-normalize-paths          Disable automatic path normalization
  --path-separator=<sep>        Path separator for human-readable paths (default: ".")
  --mode=<name>                 Mode passed to JS/TS config factories (default: production)

Dump Options:
  --format=<format>             yaml, json, inspect (default: yaml)
  --output=<file>               Write serialized output to file instead of stdout
  --save-dir=<dir>              Write split outputs to a directory
  --annotate                    Add inline docs (YAML only)
  --bundler=<webpack|rspack>    Bundler metadata label (or build override)
  --mode=<name>                 Mode passed to JS/TS config factories (default: production)
  --environment=<name>          Environment metadata label
  --config-type=<type>          Config type metadata label (default: client)
  --app-root=<path>             Root path for relativizing absolute paths (default: cwd)
  --env=<KEY=VALUE>             Set env var before loading config (repeatable)
  --clean                       Strip plugin internals and compact functions before dump (recommended for secrets safety)
  --no-warn-sensitive           Suppress the sensitive-output warning when running dump without --clean

Build Matrix Options (dump):
  --config-file=<file>          Build config file (default: config/pack-config-diff-builds.yml)
  --build=<name>                Dump one named build from build config
  --all-builds                  Dump all builds from build config
  --list-builds                 List builds from build config

Other Options:
  --help, -h                    Show this help message

Supported File Formats:
  - JSON (.json)
  - YAML (.yaml, .yml)
  - JavaScript (.js)
  - TypeScript (.ts) - requires ts-node

Exit Codes:
  0 - Success, no differences found for diff command
  1 - Differences found for diff command
  2 - Error (invalid arguments, missing files, etc.)`;

function splitCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function parseOptionToken(arg: string): OptionToken {
  const delimiterIndex = arg.indexOf("=");
  if (delimiterIndex === -1) {
    return { name: arg };
  }

  return {
    name: arg.slice(0, delimiterIndex),
    inlineValue: arg.slice(delimiterIndex + 1),
  };
}

function readOptionValue(
  inlineValue: string | undefined,
  args: string[],
  index: number,
): { value: string | undefined; consumesNext: boolean } {
  if (inlineValue !== undefined) {
    return { value: inlineValue, consumesNext: false };
  }

  const next = index + 1 < args.length ? args[index + 1] : undefined;
  if (next && (next === "-h" || next === "--help" || next.startsWith("--"))) {
    return { value: undefined, consumesNext: false };
  }
  return { value: next, consumesNext: next !== undefined };
}

function parseBundler(value: string): "webpack" | "rspack" {
  if (value !== "webpack" && value !== "rspack") {
    throw new Error(`Invalid bundler: ${value}. Expected 'webpack' or 'rspack'.`);
  }

  return value;
}

function parseDiffArgs(args: string[]): ParsedDiffArgs {
  const parsed: ParsedDiffArgs = {
    mode: "production",
    format: "detailed",
    includeUnchanged: false,
    pluginAware: false,
    matchRulesByTest: false,
    maxDepth: null,
    ignoreKeys: [],
    ignorePaths: [],
    normalizePaths: true,
    pathSeparator: ".",
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const { name, inlineValue } = parseOptionToken(arg);
    const { value: nextValue, consumesNext } = readOptionValue(inlineValue, args, index);

    switch (name) {
      case "--left":
        if (!nextValue) {
          throw new Error("Missing value for --left");
        }
        parsed.left = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--right":
        if (!nextValue) {
          throw new Error("Missing value for --right");
        }
        parsed.right = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--format": {
        if (!nextValue) {
          throw new Error("Missing value for --format");
        }

        if (!["detailed", "summary", "json", "yaml", "markdown"].includes(nextValue)) {
          throw new Error(`Invalid format: ${nextValue}`);
        }

        parsed.format = nextValue as DiffOutputFormat;
        if (consumesNext) {
          index += 1;
        }
        break;
      }
      case "--output":
        if (!nextValue) {
          throw new Error("Missing value for --output");
        }
        parsed.output = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--include-unchanged":
        parsed.includeUnchanged = true;
        break;
      case "--plugin-aware":
        parsed.pluginAware = true;
        break;
      case "--match-rules-by-test":
        parsed.matchRulesByTest = true;
        break;
      case "--max-depth":
        if (!nextValue) {
          throw new Error("Missing value for --max-depth");
        }

        parsed.maxDepth = nextValue === "null" ? null : Number(nextValue);
        if (Number.isNaN(parsed.maxDepth)) {
          throw new Error(`Invalid --max-depth value: ${nextValue}`);
        }
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--ignore-keys":
        parsed.ignoreKeys = splitCsv(nextValue);
        if (consumesNext && nextValue) {
          index += 1;
        }
        break;
      case "--ignore-paths":
        parsed.ignorePaths = splitCsv(nextValue);
        if (consumesNext && nextValue) {
          index += 1;
        }
        break;
      case "--no-normalize-paths":
        parsed.normalizePaths = false;
        break;
      case "--path-separator":
        if (!nextValue) {
          throw new Error("Missing value for --path-separator");
        }
        parsed.pathSeparator = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--mode":
        if (!nextValue) {
          throw new Error("Missing value for --mode");
        }
        parsed.mode = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown argument: ${arg}`);
        }
    }
  }

  return parsed;
}

function parseDumpArgs(args: string[]): ParsedDumpArgs {
  const parsed: ParsedDumpArgs = {
    format: "yaml",
    annotate: false,
    mode: "production",
    appRoot: process.cwd(),
    env: [],
    clean: false,
    warnSensitive: true,
    allBuilds: false,
    listBuilds: false,
    buildConfigFile: DEFAULT_BUILD_CONFIG_FILE,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("-")) {
      if (!parsed.configFile) {
        parsed.configFile = arg;
        continue;
      }

      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    const { name, inlineValue } = parseOptionToken(arg);
    const { value: nextValue, consumesNext } = readOptionValue(inlineValue, args, index);

    switch (name) {
      case "--format": {
        if (!nextValue) {
          throw new Error("Missing value for --format");
        }

        if (!["yaml", "json", "inspect"].includes(nextValue)) {
          throw new Error(`Invalid dump format: ${nextValue}`);
        }

        parsed.format = nextValue as DumpOutputFormat;
        if (consumesNext) {
          index += 1;
        }
        break;
      }
      case "--output":
        if (!nextValue) {
          throw new Error("Missing value for --output");
        }
        parsed.output = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--save-dir":
        if (!nextValue) {
          throw new Error("Missing value for --save-dir");
        }
        parsed.saveDir = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--annotate":
        parsed.annotate = true;
        break;
      case "--bundler":
        if (!nextValue) {
          throw new Error("Missing value for --bundler");
        }
        parsed.bundler = parseBundler(nextValue);
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--mode":
        if (!nextValue) {
          throw new Error("Missing value for --mode");
        }
        parsed.mode = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--environment":
        if (!nextValue) {
          throw new Error("Missing value for --environment");
        }
        parsed.environment = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--config-type":
        if (!nextValue) {
          throw new Error("Missing value for --config-type");
        }
        parsed.configType = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--app-root":
        if (!nextValue) {
          throw new Error("Missing value for --app-root");
        }
        parsed.appRoot = path.resolve(nextValue);
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--env":
        if (!nextValue) {
          throw new Error("Missing value for --env");
        }
        parsed.env.push(nextValue);
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--clean":
        parsed.clean = true;
        break;
      case "--no-warn-sensitive":
        parsed.warnSensitive = false;
        break;
      case "--config-file":
        if (!nextValue) {
          throw new Error("Missing value for --config-file");
        }
        parsed.buildConfigFile = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--build":
        if (!nextValue) {
          throw new Error("Missing value for --build");
        }
        parsed.build = nextValue;
        if (consumesNext) {
          index += 1;
        }
        break;
      case "--all-builds":
        parsed.allBuilds = true;
        break;
      case "--list-builds":
        parsed.listBuilds = true;
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (parsed.build && parsed.allBuilds) {
    throw new Error("--build and --all-builds are mutually exclusive");
  }

  if (parsed.output && parsed.allBuilds) {
    throw new Error("--output cannot be used with --all-builds. Use --save-dir instead.");
  }

  if (parsed.output && parsed.saveDir) {
    throw new Error("--output and --save-dir are mutually exclusive");
  }

  if (parsed.listBuilds && (parsed.build || parsed.allBuilds || parsed.configFile)) {
    throw new Error(
      "--list-builds cannot be combined with positional config file, --build, or --all-builds",
    );
  }

  if (parsed.listBuilds && (parsed.output || parsed.saveDir)) {
    throw new Error("--list-builds cannot be combined with --output or --save-dir");
  }

  const usingBuildConfig = parsed.listBuilds || parsed.allBuilds || Boolean(parsed.build);
  if (usingBuildConfig && parsed.configFile) {
    throw new Error(
      "Positional <config-file> cannot be combined with --build/--all-builds/--list-builds",
    );
  }

  if (!parsed.help && !parsed.configFile && !usingBuildConfig) {
    throw new Error(
      "Missing required config file path for dump command. Provide <config-file> or use --build/--all-builds/--list-builds.",
    );
  }

  return parsed;
}

function maybeNormalizeConfig(
  config: unknown,
  enabled: boolean,
): { normalizedConfig: unknown; metadata: unknown } {
  if (!enabled) {
    return {
      normalizedConfig: config,
      metadata: {
        normalizedPaths: false,
      },
    };
  }

  const detectedBasePath = PathNormalizer.detectBasePath(config);
  const normalizer = new PathNormalizer(detectedBasePath);
  const result = normalizer.normalize(config);

  return {
    normalizedConfig: result.normalized,
    metadata: {
      normalizedPaths: true,
      detectedBasePath,
    },
  };
}

function formatDiffOutput(
  formatter: DiffFormatter,
  format: DiffOutputFormat,
  result: ReturnType<DiffEngine["compare"]>,
): string {
  switch (format) {
    case "json":
      return formatter.formatJson(result);
    case "yaml":
      return formatter.formatYaml(result);
    case "summary":
      return formatter.formatSummary(result);
    case "markdown":
      return formatter.formatMarkdown(result);
    case "detailed":
    default:
      return formatter.formatDetailed(result);
  }
}

function applyEnvVariables(entries: string[]): () => void {
  const parsedEntries = entries.map((entry) => {
    const delimiterIndex = entry.indexOf("=");
    if (delimiterIndex <= 0) {
      throw new Error(`Invalid --env value: ${entry}. Expected KEY=VALUE.`);
    }

    return {
      key: entry.slice(0, delimiterIndex),
      value: entry.slice(delimiterIndex + 1),
    };
  });

  parsedEntries.forEach(({ key }) => {
    if (!isValidEnvVarName(key)) {
      throw new Error(
        `Invalid --env key: ${key}. Expected a shell-style env var name (e.g. NODE_ENV).`,
      );
    }
  });

  const previousValues = new Map<string, string | undefined>();

  parsedEntries.forEach(({ key, value }) => {
    if (!previousValues.has(key)) {
      previousValues.set(key, process.env[key]);
    }

    process.env[key] = value;
  });

  return () => {
    previousValues.forEach((value, key) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  };
}

function warnPotentialSensitiveDumpOutput(): void {
  console.error(
    "[pack-config-diff] Warning: dump output without --clean may include sensitive values (for example, plugin definitions or env defaults).",
  );
}

function serializeDumpPayload(
  config: unknown,
  metadata: DumpMetadata,
  parsed: ParsedDumpArgs,
): string {
  const serializedConfig = parsed.clean ? cleanConfig(config, parsed.appRoot) : config;

  return serializeConfig(serializedConfig, metadata, {
    format: parsed.format,
    annotate: parsed.annotate,
    appRoot: parsed.appRoot,
  });
}

function resolveConfigTypes(
  configCount: number,
  configuredTypes: string[],
  fallbackType: string,
): string[] {
  if (configuredTypes.length > 0) {
    if (configuredTypes.length !== configCount) {
      throw new Error(
        `Config output count mismatch: loaded ${configCount} config(s) but outputs specifies ${configuredTypes.length} type(s)`,
      );
    }

    return configuredTypes;
  }

  if (configCount === 1) {
    return [fallbackType];
  }

  return Array.from({ length: configCount }, (_, index) => `config-${index + 1}`);
}

function buildSplitDumpOutputs(config: unknown, options: SplitDumpOptions): FileOutput[] {
  const configs = Array.isArray(config) ? config : [config];
  const configTypes = resolveConfigTypes(
    configs.length,
    options.outputs,
    options.fallbackConfigType,
  );

  return configs.map((singleConfig, index) => {
    const metadata: DumpMetadata = {
      exportedAt: new Date().toISOString(),
      bundler: options.bundler,
      environment: options.environment,
      configType: configTypes[index],
      configCount: configs.length,
    };

    const content = serializeDumpPayload(singleConfig, metadata, options.parsed);

    return {
      filename: FileWriter.generateFilename(
        options.bundler,
        options.environment,
        metadata.configType,
        options.parsed.format,
        options.buildName,
      ),
      content: `${content}\n`,
      metadata,
    };
  });
}

function resolveBuildEnvironmentLabel(
  build: ResolvedDumpBuild,
  parsed: ParsedDumpArgs,
): { label: string; source: "explicit" | "build-node-env" | "default" } {
  if (parsed.environment) {
    return { label: parsed.environment, source: "explicit" };
  }

  if (build.environment.NODE_ENV) {
    return {
      label: build.environment.NODE_ENV,
      source: "build-node-env",
    };
  }

  return { label: "production", source: "default" };
}

function printBuildSummaries(loader: BuildConfigFileLoader, parsed: ParsedDumpArgs): void {
  const builds = loader.listBuilds(parsed.bundler);

  console.log(`Available builds in ${loader.filePath}:`);
  builds.forEach((build) => {
    console.log();
    console.log(`- ${build.name}`);
    if (build.description) {
      console.log(`  description: ${build.description}`);
    }
    console.log(`  bundler: ${build.bundler}`);
    console.log(`  config: ${build.config}`);
    if (build.outputs.length > 0) {
      console.log(`  outputs: ${build.outputs.join(", ")}`);
    }
  });
}

function runDumpFromBuildConfig(parsed: ParsedDumpArgs): number {
  const loader = new BuildConfigFileLoader(parsed.buildConfigFile);
  const restoreCliEnv = applyEnvVariables(parsed.env);

  if (parsed.listBuilds) {
    try {
      printBuildSummaries(loader, parsed);
      return 0;
    } finally {
      restoreCliEnv();
    }
  }

  let builds: ResolvedDumpBuild[];
  try {
    builds = parsed.allBuilds
      ? loader.resolveAllBuilds(parsed.bundler)
      : [loader.resolveBuild(parsed.build as string, parsed.bundler)];
  } finally {
    restoreCliEnv();
  }

  const outputs: FileOutput[] = [];

  for (const build of builds) {
    const buildEnvEntries = Object.entries(build.environment).map(
      ([key, value]) => `${key}=${value}`,
    );
    const restoreEnv = applyEnvVariables([...buildEnvEntries, ...parsed.env]);

    try {
      const resolvedEnvironment = resolveBuildEnvironmentLabel(build, parsed);
      const envLabel = resolvedEnvironment.label;
      if (resolvedEnvironment.source === "build-node-env" && parsed.warnSensitive) {
        console.error(
          `[pack-config-diff] Using build "${build.name}" NODE_ENV="${envLabel}" as dump environment label. Pass --environment to override.`,
        );
      }
      const loadedConfig = loadConfigFile(build.config, parsed.mode);
      outputs.push(
        ...buildSplitDumpOutputs(loadedConfig, {
          bundler: build.bundler,
          environment: envLabel,
          buildName: build.name,
          outputs: build.outputs,
          fallbackConfigType: parsed.configType || "client",
          parsed,
        }),
      );
    } finally {
      restoreEnv();
    }
  }

  if (outputs.length === 0) {
    throw new Error(
      "No config outputs were generated. Check that your config file exports a valid configuration.",
    );
  }

  if (parsed.output) {
    if (outputs.length !== 1) {
      throw new Error("--output can only be used when exactly one config output is generated");
    }

    FileWriter.writeSingleFile(path.resolve(parsed.output), outputs[0].content);
    return 0;
  }

  const shouldWriteFiles = parsed.allBuilds || Boolean(parsed.saveDir) || outputs.length > 1;
  if (shouldWriteFiles) {
    const targetDir = path.resolve(parsed.saveDir || DEFAULT_DUMP_SAVE_DIR);
    if (!parsed.saveDir) {
      console.error(
        `Writing ${outputs.length} files to ${targetDir}/ (use --save-dir to customize)`,
      );
    }
    FileWriter.writeMultipleFiles(outputs, targetDir);
    return 0;
  }

  console.log(outputs[0].content.trimEnd());
  return 0;
}

function runDumpSingle(parsed: ParsedDumpArgs): number {
  const configFile = parsed.configFile;
  if (!configFile) {
    throw new Error("Missing required config file path for dump command");
  }

  const restoreEnv = applyEnvVariables(parsed.env);

  try {
    const environment = parsed.environment || "production";
    const loadedConfig = loadConfigFile(configFile, parsed.mode);
    const configCount = Array.isArray(loadedConfig) ? loadedConfig.length : 1;
    const metadata: DumpMetadata = {
      exportedAt: new Date().toISOString(),
      bundler: parsed.bundler || "webpack",
      environment,
      configType: parsed.configType || "client",
      configCount,
    };

    if (parsed.saveDir) {
      const outputs = buildSplitDumpOutputs(loadedConfig, {
        bundler: metadata.bundler,
        environment: metadata.environment,
        outputs: [],
        fallbackConfigType: metadata.configType,
        parsed,
      });
      if (outputs.length === 0) {
        throw new Error(
          "No config outputs were generated. Check that your config file exports a valid configuration.",
        );
      }
      FileWriter.writeMultipleFiles(outputs, path.resolve(parsed.saveDir));
      return 0;
    }

    const output = serializeDumpPayload(loadedConfig, metadata, parsed);

    if (parsed.output) {
      FileWriter.writeSingleFile(path.resolve(parsed.output), `${output}\n`);
    } else {
      console.log(output.trimEnd());
    }

    return 0;
  } finally {
    restoreEnv();
  }
}

function runDump(args: string[]): number {
  const parsed = parseDumpArgs(args);

  if (parsed.help) {
    console.log(HELP_TEXT);
    return 0;
  }

  if (parsed.annotate && parsed.format !== "yaml") {
    throw new Error("--annotate requires --format=yaml");
  }

  if (parsed.warnSensitive && !parsed.clean && !parsed.listBuilds) {
    warnPotentialSensitiveDumpOutput();
  }

  if (parsed.listBuilds || parsed.allBuilds || parsed.build) {
    return runDumpFromBuildConfig(parsed);
  }

  return runDumpSingle(parsed);
}

function runDiff(args: string[]): number {
  const parsed = parseDiffArgs(args);

  if (parsed.help) {
    console.log(HELP_TEXT);
    return 0;
  }

  if (!parsed.left || !parsed.right) {
    throw new Error("Both --left and --right are required. Use --help for usage details.");
  }

  const leftConfig = loadConfigFile(parsed.left, parsed.mode);
  const rightConfig = loadConfigFile(parsed.right, parsed.mode);

  const normalizedLeft = maybeNormalizeConfig(leftConfig, parsed.normalizePaths);
  const normalizedRight = maybeNormalizeConfig(rightConfig, parsed.normalizePaths);

  const options: DiffOptions = {
    includeUnchanged: parsed.includeUnchanged,
    pluginAware: parsed.pluginAware,
    matchRulesByTest: parsed.matchRulesByTest,
    maxDepth: parsed.maxDepth,
    ignoreKeys: parsed.ignoreKeys,
    ignorePaths: parsed.ignorePaths,
    pathSeparator: parsed.pathSeparator,
  };

  const engine = new DiffEngine(options);
  const result = engine.compare(normalizedLeft.normalizedConfig, normalizedRight.normalizedConfig, {
    leftFile: parsed.left,
    rightFile: parsed.right,
    leftMetadata: normalizedLeft.metadata,
    rightMetadata: normalizedRight.metadata,
  });

  const formatter = new DiffFormatter();
  const output = formatDiffOutput(formatter, parsed.format, result);

  if (parsed.output) {
    FileWriter.writeSingleFile(path.resolve(parsed.output), `${output}\n`);
  } else {
    console.log(output);
  }

  return result.summary.totalChanges === 0 ? 0 : 1;
}

export function run(args: string[]): number {
  try {
    const [command, ...rest] = args;

    if (!command || command.startsWith("-")) {
      return runDiff(args);
    }

    if (command === "diff") {
      return runDiff(rest);
    }

    if (command === "dump") {
      return runDump(rest);
    }

    throw new Error(`Unknown command: ${command}. Use --help for usage details.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 2;
  }
}

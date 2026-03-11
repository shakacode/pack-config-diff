import fs from "fs"
import path from "path"

import yaml from "js-yaml"

import { DiffEngine } from "./diffEngine"
import { DiffFormatter } from "./formatter"
import { PathNormalizer } from "./pathNormalizer"
import type { DiffOptions } from "./types"

type OutputFormat = "detailed" | "summary" | "json" | "yaml" | "markdown"

interface ParsedArgs {
  left?: string
  right?: string
  format: OutputFormat
  output?: string
  includeUnchanged: boolean
  pluginAware: boolean
  matchRulesByTest: boolean
  maxDepth: number | null
  ignoreKeys: string[]
  ignorePaths: string[]
  normalizePaths: boolean
  pathSeparator: string
  help: boolean
}

const HELP_TEXT = `pack-config-diff — Semantic config differ for webpack and rspack

Compare two webpack/rspack configuration files and identify differences.

Usage:
  pack-config-diff --left=<file1> --right=<file2> [options]

Required Options:
  --left=<file>              Path to the first (left) config file
  --right=<file>             Path to the second (right) config file

Output Options:
  --format=<format>          Output format: detailed, summary, json, yaml, markdown (default: detailed)
  --output=<file>            Write output to file instead of stdout

Comparison Options:
  --include-unchanged        Include unchanged values in output
  --max-depth=<number>       Maximum depth for comparison (default: unlimited)
  --ignore-keys=<keys>       Comma-separated list of keys to ignore
  --ignore-paths=<paths>     Comma-separated list of paths to ignore (supports wildcards)
  --plugin-aware             Compare class-instance plugins by constructor + options
  --match-rules-by-test      Match module.rules entries by rule test instead of index
  --no-normalize-paths       Disable automatic path normalization
  --path-separator=<sep>     Path separator for human-readable paths (default: ".")

Other Options:
  --help, -h                 Show this help message

Supported File Formats:
  - JSON (.json)
  - YAML (.yaml, .yml)
  - JavaScript (.js)
  - TypeScript (.ts) - requires ts-node

Exit Codes:
  0 - Success, no differences found
  1 - Differences found or error occurred`

function splitCsv(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    format: "detailed",
    includeUnchanged: false,
    pluginAware: false,
    matchRulesByTest: false,
    maxDepth: null,
    ignoreKeys: [],
    ignorePaths: [],
    normalizePaths: true,
    pathSeparator: ".",
    help: false
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    const [name, inlineValue] = arg.split("=", 2)
    const nextValue = inlineValue ?? (index + 1 < args.length ? args[index + 1] : undefined)
    const consumesNext = inlineValue === undefined

    switch (name) {
      case "--left":
        if (!nextValue) {
          throw new Error("Missing value for --left")
        }
        parsed.left = nextValue
        if (consumesNext) {
          index += 1
        }
        break
      case "--right":
        if (!nextValue) {
          throw new Error("Missing value for --right")
        }
        parsed.right = nextValue
        if (consumesNext) {
          index += 1
        }
        break
      case "--format": {
        if (!nextValue) {
          throw new Error("Missing value for --format")
        }

        if (!["detailed", "summary", "json", "yaml", "markdown"].includes(nextValue)) {
          throw new Error(`Invalid format: ${nextValue}`)
        }

        parsed.format = nextValue as OutputFormat
        if (consumesNext) {
          index += 1
        }
        break
      }
      case "--output":
        if (!nextValue) {
          throw new Error("Missing value for --output")
        }
        parsed.output = nextValue
        if (consumesNext) {
          index += 1
        }
        break
      case "--include-unchanged":
        parsed.includeUnchanged = true
        break
      case "--plugin-aware":
        parsed.pluginAware = true
        break
      case "--match-rules-by-test":
        parsed.matchRulesByTest = true
        break
      case "--max-depth":
        if (!nextValue) {
          throw new Error("Missing value for --max-depth")
        }

        parsed.maxDepth = nextValue === "null" ? null : Number(nextValue)
        if (Number.isNaN(parsed.maxDepth)) {
          throw new Error(`Invalid --max-depth value: ${nextValue}`)
        }
        if (consumesNext) {
          index += 1
        }
        break
      case "--ignore-keys":
        parsed.ignoreKeys = splitCsv(nextValue)
        if (consumesNext && nextValue) {
          index += 1
        }
        break
      case "--ignore-paths":
        parsed.ignorePaths = splitCsv(nextValue)
        if (consumesNext && nextValue) {
          index += 1
        }
        break
      case "--no-normalize-paths":
        parsed.normalizePaths = false
        break
      case "--path-separator":
        if (!nextValue) {
          throw new Error("Missing value for --path-separator")
        }
        parsed.pathSeparator = nextValue
        if (consumesNext) {
          index += 1
        }
        break
      case "--help":
      case "-h":
        parsed.help = true
        break
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown argument: ${arg}`)
        }
    }
  }

  return parsed
}

function resolveExportedConfig(moduleExports: unknown): unknown {
  if (typeof moduleExports === "function") {
    return (moduleExports as (env?: unknown, argv?: unknown) => unknown)({}, { mode: "production" })
  }

  return moduleExports
}

function loadJsLikeConfig(absolutePath: string): unknown {
  const resolvedModulePath = require.resolve(absolutePath)
  delete require.cache[resolvedModulePath]

  const moduleExports = require(resolvedModulePath)
  const config = moduleExports?.default ?? moduleExports

  return resolveExportedConfig(config)
}

function loadConfigFile(filePath: string): unknown {
  const absolutePath = path.resolve(filePath)
  const extension = path.extname(absolutePath).toLowerCase()

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${filePath}`)
  }

  switch (extension) {
    case ".json": {
      const content = fs.readFileSync(absolutePath, "utf8")
      return JSON.parse(content)
    }
    case ".yaml":
    case ".yml": {
      const content = fs.readFileSync(absolutePath, "utf8")
      return yaml.load(content)
    }
    case ".js":
      return loadJsLikeConfig(absolutePath)
    case ".ts":
      try {
        require("ts-node/register/transpile-only")
      } catch (error) {
        throw new Error(
          `Cannot load TypeScript config (${filePath}): ts-node is required. Install it with \"npm install --save-dev ts-node\".`
        )
      }

      return loadJsLikeConfig(absolutePath)
    default:
      throw new Error(`Unsupported file extension: ${extension || "(none)"}`)
  }
}

function maybeNormalizeConfig(config: unknown, enabled: boolean): { normalizedConfig: unknown; metadata: unknown } {
  if (!enabled) {
    return {
      normalizedConfig: config,
      metadata: {
        normalizedPaths: false
      }
    }
  }

  const detectedBasePath = PathNormalizer.detectBasePath(config)
  const normalizer = new PathNormalizer(detectedBasePath)
  const result = normalizer.normalize(config)

  return {
    normalizedConfig: result.normalized,
    metadata: {
      normalizedPaths: true,
      detectedBasePath
    }
  }
}

function formatOutput(formatter: DiffFormatter, format: OutputFormat, result: ReturnType<DiffEngine["compare"]>): string {
  switch (format) {
    case "json":
      return formatter.formatJson(result)
    case "yaml":
      return formatter.formatYaml(result)
    case "summary":
      return formatter.formatSummary(result)
    case "markdown":
      return formatter.formatMarkdown(result)
    case "detailed":
    default:
      return formatter.formatDetailed(result)
  }
}

export function run(args: string[]): number {
  try {
    const parsed = parseArgs(args)

    if (parsed.help) {
      console.log(HELP_TEXT)
      return 0
    }

    if (!parsed.left || !parsed.right) {
      throw new Error("Both --left and --right are required. Use --help for usage details.")
    }

    const leftConfig = loadConfigFile(parsed.left)
    const rightConfig = loadConfigFile(parsed.right)

    const normalizedLeft = maybeNormalizeConfig(leftConfig, parsed.normalizePaths)
    const normalizedRight = maybeNormalizeConfig(rightConfig, parsed.normalizePaths)

    const options: DiffOptions = {
      includeUnchanged: parsed.includeUnchanged,
      pluginAware: parsed.pluginAware,
      matchRulesByTest: parsed.matchRulesByTest,
      maxDepth: parsed.maxDepth,
      ignoreKeys: parsed.ignoreKeys,
      ignorePaths: parsed.ignorePaths,
      pathSeparator: parsed.pathSeparator
    }

    const engine = new DiffEngine(options)
    const result = engine.compare(normalizedLeft.normalizedConfig, normalizedRight.normalizedConfig, {
      leftFile: parsed.left,
      rightFile: parsed.right,
      leftMetadata: normalizedLeft.metadata,
      rightMetadata: normalizedRight.metadata
    })

    const formatter = new DiffFormatter()
    const output = formatOutput(formatter, parsed.format, result)

    if (parsed.output) {
      fs.writeFileSync(path.resolve(parsed.output), `${output}\n`, "utf8")
    } else {
      console.log(output)
    }

    return result.summary.totalChanges === 0 ? 0 : 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return 1
  }
}

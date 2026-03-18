export type DiffOperation = "added" | "removed" | "changed" | "unchanged";

export interface DiffPath {
  path: string[];
  humanPath: string;
}

export interface DiffEntry {
  operation: DiffOperation;
  path: DiffPath;
  oldValue?: unknown;
  newValue?: unknown;
  valueType?: string;
}

export interface DiffResult {
  summary: {
    totalChanges: number;
    added: number;
    removed: number;
    changed: number;
    unchanged?: number;
  };
  entries: DiffEntry[];
  metadata: {
    comparedAt: string;
    leftFile?: string;
    rightFile?: string;
    leftMetadata?: unknown;
    rightMetadata?: unknown;
  };
}

export interface DiffOptions {
  includeUnchanged?: boolean;
  maxDepth?: number | null;
  ignoreKeys?: string[];
  ignorePaths?: string[];
  format?: "json" | "yaml" | "summary" | "detailed" | "markdown";
  normalizePaths?: boolean;
  pathSeparator?: string;
  pluginAware?: boolean;
  matchRulesByTest?: boolean;
}

export interface NormalizedConfig {
  original: unknown;
  normalized: unknown;
  basePath?: string;
}

export interface DumpMetadata {
  exportedAt: string
  bundler: string
  environment: string
  configType: string
  configCount: number
}

export interface SerializeOptions {
  format: "yaml" | "json" | "inspect"
  annotate?: boolean
  appRoot?: string
  depth?: number | null
}

export interface FileOutput {
  filename: string
  content: string
  metadata: DumpMetadata
}

export interface DumpBuildConfig {
  description?: string
  bundler?: "webpack" | "rspack"
  environment?: Record<string, string>
  outputs?: string[]
  config: string
}

export interface DumpBuildConfigFile {
  default_bundler?: "webpack" | "rspack"
  builds: Record<string, DumpBuildConfig>
}

export interface ResolvedDumpBuild {
  name: string
  description?: string
  bundler: "webpack" | "rspack"
  environment: Record<string, string>
  outputs: string[]
  config: string
}

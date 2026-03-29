# Programmatic API

Use `pack-config-diff` from Node.js code when you need to integrate config comparison into build scripts, tests, or custom tooling.

## Install

```bash
npm install pack-config-diff
```

## Basic usage

```javascript
const { DiffEngine, DiffFormatter } = require("pack-config-diff");

const leftConfig = {
  mode: "development",
  output: { filename: "bundle.js" },
  optimization: { minimize: false },
};

const rightConfig = {
  mode: "production",
  output: { filename: "bundle-[contenthash].js" },
  optimization: { minimize: true },
};

const engine = new DiffEngine();
const result = engine.compare(leftConfig, rightConfig, {
  leftFile: "webpack.dev.js",
  rightFile: "webpack.prod.js",
});

const formatter = new DiffFormatter();
console.log(formatter.formatDetailed(result));
```

## Dump helpers

```javascript
const { loadConfigFile, cleanConfig, serializeConfig } = require("pack-config-diff");

const rawConfig = loadConfigFile("webpack.config.js");
const cleaned = cleanConfig(rawConfig, process.cwd());
const yamlOutput = serializeConfig(
  cleaned,
  {
    exportedAt: new Date().toISOString(),
    bundler: "webpack",
    environment: "development",
    configType: "client",
    configCount: Array.isArray(cleaned) ? cleaned.length : 1,
  },
  {
    format: "yaml",
    annotate: true,
    appRoot: process.cwd(),
  },
);

console.log(yamlOutput);
```

## `DiffEngine`

### Constructor options

```javascript
const engine = new DiffEngine({
  includeUnchanged: false, // include unchanged values in results
  format: "detailed", // output format metadata (json/yaml/summary/detailed/markdown)
  normalizePaths: true, // convert absolute paths to relative before comparing
  pluginAware: false, // compare class instances by properties
  matchRulesByTest: false, // match module.rules by test pattern
  maxDepth: null, // limit comparison depth (null = unlimited)
  ignoreKeys: [], // keys to skip everywhere
  ignorePaths: [], // dot-paths to skip (supports wildcards)
  pathSeparator: ".", // separator for human-readable paths
});
```

### `engine.compare(left, right, metadata)`

Compares two config objects. Returns a result object with:

- `summary` — `{ totalChanges, added, removed, changed }`
- `entries` — array of diff entries, each with `operation`, `path`, `oldValue`, `newValue`, `valueType`
- `metadata` — comparison metadata (filenames, timestamps)

```javascript
const result = engine.compare(leftConfig, rightConfig, {
  leftFile: "dev.json", // label for the left side
  rightFile: "prod.json", // label for the right side
});

console.log(result.summary.totalChanges); // number of differences
console.log(result.entries); // array of diff entries
```

## `DiffFormatter`

### Available methods

| Method                   | Returns                                               |
| ------------------------ | ----------------------------------------------------- |
| `formatDetailed(result)` | Human-readable string with descriptions and doc links |
| `formatSummary(result)`  | One-line count string                                 |
| `formatJson(result)`     | JSON string                                           |
| `formatYaml(result)`     | YAML string                                           |
| `formatMarkdown(result)` | GitHub-flavored markdown table                        |

### Example: generate a markdown report

```javascript
const { DiffEngine, DiffFormatter } = require("pack-config-diff");
const fs = require("fs");

const engine = new DiffEngine({ ignorePaths: ["devServer.*"] });
const result = engine.compare(baselineConfig, currentConfig, {
  leftFile: "baseline",
  rightFile: "current",
});

const formatter = new DiffFormatter();
fs.writeFileSync("diff-report.md", formatter.formatMarkdown(result));
```

### Example: CI gate on config changes

```javascript
const { DiffEngine } = require("pack-config-diff");

const engine = new DiffEngine();
const result = engine.compare(expectedConfig, actualConfig, {
  leftFile: "expected",
  rightFile: "actual",
});

if (result.summary.totalChanges > 0) {
  console.error(`Config drift detected: ${result.summary.totalChanges} unexpected changes`);
  process.exit(1);
}
```

## `PathNormalizer`

Converts absolute filesystem paths to relative paths so configs from different machines are comparable.

```javascript
const { PathNormalizer } = require("pack-config-diff");

const config = {
  output: { path: "/Users/alice/project/public/packs" },
};

const basePath = PathNormalizer.detectBasePath(config);
const normalizer = new PathNormalizer(basePath);
const { normalized } = normalizer.normalize(config);

console.log(normalized.output.path); // "./public/packs"
```

## Additional exports

`pack-config-diff` also exports:

- `YamlSerializer` for direct YAML serialization with optional inline docs.
- `FileWriter` for writing single/multi-file dump outputs.
- `BuildConfigFileLoader` for loading `config/pack-config-diff-builds.yml` style build matrices.

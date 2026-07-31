# pack-config-diff

Semantic configuration tooling for webpack and rspack projects.

`pack-config-diff` supports both:

- `diff`: compare two webpack/rspack **configuration objects** and explain what changed.
- `dump`: serialize live webpack/rspack configs to YAML/JSON/inspect for review or diffing.

Extracted from [Shakapacker](https://github.com/shakacode/shakapacker), battle-tested in production workflows.

## Why use this?

- Debug "works in dev, broken in prod" by comparing two configs side by side
- Validate webpack -> rspack migration parity
- Audit config changes before/after dependency upgrades
- Compare CI vs local bundler behavior
- Generate PR-ready markdown diff reports

## Install

```bash
npm install pack-config-diff
```

## Contributor setup

```bash
npm install
npm run hooks:install
```

Run `npm run hooks:install` once per clone to wire up lefthook locally.

## Quick start

### Compare two configs (`diff`)

The tool takes two config files (`--left` and `--right`) and shows what's different between them. Config files can be **JavaScript, TypeScript, JSON, or YAML**.

```bash
pack-config-diff --left=webpack.dev.js --right=webpack.prod.js
```

```text
================================================================================
Webpack/Rspack Configuration Comparison
================================================================================

Comparing: webpack.dev.js
      vs:  webpack.prod.js

Found 4 difference(s): 0 added, 0 removed, 4 changed

================================================================================

1. [~] mode

   What it does:
   Defines the environment mode (development, production, or none). Controls built-in optimizations and defaults.

   Affects: Minification, tree-shaking, source maps, and performance optimizations

   Values:
     dev:  "development"
     prod: "production"

   Impact: Enabling production optimizations (minification, tree-shaking)

   Documentation: https://webpack.js.org/configuration/mode/

2. [~] output.filename

   What it does:
   Filename template for entry chunks. Can include [name], [hash], [contenthash].

   Affects: Output filenames and cache busting strategy

   Values:
     dev:  "bundle.js"
     prod: "bundle-[contenthash].js"

   Impact: Cache busting enabled - better long-term caching

   Documentation: https://webpack.js.org/configuration/output/#outputfilename

...

================================================================================

Legend:
  [+] = Added in prod
  [-] = Removed from prod
  [~] = Changed between configs
```

### Export a live config snapshot (`dump`)

```bash
pack-config-diff dump webpack.config.js --format=yaml --mode=development --output=webpack-development-client.yml
```

> Security note: `dump` output without `--clean` may include sensitive plugin/env values. Use `--clean` when sharing snapshots.
> For trusted internal automation, add `--no-warn-sensitive` to suppress the warning.
> For build-matrix dumps, add `--no-warn-env-label` to suppress only the `NODE_ENV` fallback environment-label note.

### More examples

```bash
# Quick summary for CI scripts
pack-config-diff --left=dev.json --right=prod.json --format=summary
# => 3 changes: +1 -0 ~2

# Markdown table for PR comments
pack-config-diff --left=baseline.json --right=current.json --format=markdown

# Ignore plugin noise when comparing JS configs with class instances
pack-config-diff --left=webpack.dev.js --right=webpack.prod.js --plugin-aware

# Evaluate JS/TS function exports with a specific mode
pack-config-diff --left=webpack.dev.js --right=webpack.prod.js --mode=development

# Ignore rule reorder noise
pack-config-diff --left=before.yaml --right=after.yaml --match-rules-by-test

# Focus on specific areas by ignoring paths
pack-config-diff --left=a.json --right=b.json --ignore-paths="plugins.*,devServer"

# Save report to a file
pack-config-diff --left=a.json --right=b.json --format=json --output=report.json

# Dump a config with inline docs (YAML only)
pack-config-diff dump webpack.config.js --annotate

# Dump as JSON with special value placeholders for functions/RegExp/class instances
pack-config-diff dump webpack.config.js --format=json

# Dump with independent mode + metadata environment labels
pack-config-diff dump webpack.config.js --mode=development --environment=staging

# Dump one named build from a build-matrix config
pack-config-diff dump --build=prod --config-file=config/pack-config-diff-builds.yml --save-dir=./config-exports

# Dump every build in the matrix
pack-config-diff dump --all-builds --config-file=config/pack-config-diff-builds.yml

# Keep sensitive warning but suppress build NODE_ENV label note
pack-config-diff dump --build=dev --config-file=config/pack-config-diff-builds.yml --no-warn-env-label
```

## What can `--left` and `--right` be?

Any file that contains a webpack/rspack configuration object:

| Format         | Extensions      | Notes                                                                                        |
| -------------- | --------------- | -------------------------------------------------------------------------------------------- |
| **JavaScript** | `.js`           | Loaded via `require()`. Supports object exports and function exports `(env, argv) => config` |
| **TypeScript** | `.ts`           | Same as JS, requires `ts-node` as a peer dependency                                          |
| **JSON**       | `.json`         | A plain JSON object representing the config                                                  |
| **YAML**       | `.yaml`, `.yml` | Same structure as JSON, just in YAML syntax                                                  |

You can mix formats: `--left=config.yaml --right=webpack.config.js` works fine.

**YAML and JSON configs** are snapshots of resolved webpack configuration objects — the same data structure that `webpack.config.js` exports, just serialized to a different format. They're useful when you want to compare configs generated by a framework (like Shakapacker), dump configs from CI builds, or store config snapshots in version control.

See [Input Formats](./docs/input-formats.md) for full details and examples.

## Programmatic API

```javascript
const { DiffEngine, DiffFormatter, loadConfigFile, serializeConfig } = require("pack-config-diff");

const engine = new DiffEngine({ ignorePaths: ["plugins.*"] });
const result = engine.compare(leftConfig, rightConfig, {
  leftFile: "webpack.dev.js",
  rightFile: "webpack.prod.js",
});

const formatter = new DiffFormatter();
console.log(formatter.formatDetailed(result));

const config = loadConfigFile("webpack.config.js");
const output = serializeConfig(
  config,
  {
    exportedAt: new Date().toISOString(),
    bundler: "webpack",
    environment: "development",
    configType: "client",
    configCount: 1,
  },
  { format: "yaml" },
);
console.log(output);
```

See [Programmatic API docs](./docs/programmatic-api.md) for full API reference.

## Documentation

- **[Getting Started](./docs/getting-started.md)** — what this tool does and how to use it
- **[Input Formats](./docs/input-formats.md)** — JS, TS, JSON, and YAML config files explained
- **[CLI Reference](./docs/cli-reference.md)** — all options and flags
- **[Output Formats](./docs/output-formats.md)** — detailed, summary, json, yaml, and markdown
- **[Comparison Modes](./docs/comparison-modes.md)** — plugin-aware mode, rule matching, path normalization
- **[Programmatic API](./docs/programmatic-api.md)** — using pack-config-diff from Node.js
- **[Releasing](./docs/releasing.md)** — how to publish new versions

## Maintainer Automation

- **Update changelog for release prep**: `/update-changelog release` (see [.claude/commands/update-changelog.md](./.claude/commands/update-changelog.md))
- **Run release dry run**: `npm run release:dry-run`
- **Publish release**: `npm run release` (script: [scripts/release.mjs](./scripts/release.mjs))
- **Re-sync GitHub release notes**: `npm run release:sync-github`
- **Address PR reviews (Claude command)**: [.claude/commands/address-review.md](./.claude/commands/address-review.md)
- **Address PR reviews (command mirror)**: [commands/address-review.md](./commands/address-review.md)
- **Address PR reviews (portable workflow prompt)**: [.agents/workflows/address-review.md](./.agents/workflows/address-review.md)

## Tests

```bash
npm test
```

## License

MIT

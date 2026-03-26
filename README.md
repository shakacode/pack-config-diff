# pack-config-diff

Semantic configuration differ for webpack and rspack projects.

`pack-config-diff` is the missing tool between config merge helpers and bundle-size differs: it compares **configuration objects themselves** and explains what changed and why it matters.

Extracted from [Shakapacker](https://github.com/shakacode/shakapacker), battle-tested in production workflows.

## Why use this?

- Debug "works in dev, broken in prod" by comparing two generated configs
- Validate webpack -> rspack migration parity
- Audit config changes before/after dependency upgrades
- Compare CI vs local bundler behavior

## Install

```bash
npm install pack-config-diff
```

## CLI

```bash
pack-config-diff --left=webpack-development-client.yaml --right=webpack-production-client.yaml
```

### Shakapacker-style workflow examples

```bash
# 1) Works in dev, breaks in prod
pack-config-diff \
  --left=shakapacker-config-exports/webpack-development-client.yaml \
  --right=shakapacker-config-exports/webpack-production-client.yaml \
  --format=summary
```

```bash
# 2) Compare client vs server production bundles
pack-config-diff \
  --left=shakapacker-config-exports/webpack-production-client.yaml \
  --right=shakapacker-config-exports/webpack-production-server.yaml
```

```bash
# 3) Focus on core config during webpack -> rspack migration
pack-config-diff \
  --left=webpack-config.yaml \
  --right=rspack-config.yaml \
  --ignore-paths="plugins.*"
```

```bash
# 4) Emit machine-readable report for CI or PR artifacts
pack-config-diff \
  --left=baseline.json \
  --right=current.json \
  --format=json \
  --output=diff-report.json
```

```bash
# 5) Reduce plugin-instance noise (constructor + option-aware comparison)
pack-config-diff \
  --left=webpack.dev.js \
  --right=webpack.prod.js \
  --plugin-aware
```

```bash
# 6) Ignore module.rules reorder noise by matching rules on `test`
pack-config-diff \
  --left=webpack-before.yaml \
  --right=webpack-after.yaml \
  --match-rules-by-test
```

```bash
# 7) Generate markdown output for PR comments
pack-config-diff \
  --left=baseline.json \
  --right=current.json \
  --format=markdown
```

### Example detailed output

```text
pack-config-diff — Semantic config diff
Comparing: webpack-development-client.yaml ↔ webpack-production-client.yaml
Found 3 difference(s): 1 added, 0 removed, 2 changed

1. [~] mode
   Description: Sets webpack optimization defaults for development or production.
   dev-client: "development"
   prod-client: "production"
   Impact: Switching mode from development to production changes optimization defaults and debugging behavior.
   Docs: https://webpack.js.org/configuration/mode/

2. [~] optimization.minimize
   Description: Enables or disables code minimization.
   dev-client: false
   prod-client: true
   Impact: Minification is now enabled, usually reducing bundle size at the cost of build time.
   Docs: https://webpack.js.org/configuration/optimization/#optimizationminimize

3. [+] target
   Description: Defines target runtime environment for output bundles.
   prod-client: "web"
   Docs: https://webpack.js.org/configuration/target/

Legend: [+] added, [-] removed, [~] changed
```

### Help

```text
pack-config-diff — Semantic config differ for webpack and rspack

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
  1 - Differences found or error occurred
```

## Programmatic API

```js
const { DiffEngine, DiffFormatter } = require("pack-config-diff")

const engine = new DiffEngine({
  includeUnchanged: false,
  ignorePaths: ["plugins.*"]
})

const result = engine.compare(leftConfig, rightConfig, {
  leftFile: "webpack.dev.js",
  rightFile: "webpack.prod.js"
})

const formatter = new DiffFormatter()
console.log(formatter.formatDetailed(result))
```

## TypeScript build

```bash
npm run build
```

## Tests

```bash
npm test
```

Test suites are ported from Shakapacker's `test/configDiffer` and run against this extracted package.

## Release

- Changelog: [`CHANGELOG.md`](./CHANGELOG.md)
- Maintainer release guide: [`docs/releasing.md`](./docs/releasing.md)
- Prerelease protocol: [`docs/releasing.md#prerelease-protocol`](./docs/releasing.md#prerelease-protocol)
- Update changelog via `/update-changelog`, merge to `main`, then run release locally
- Release engine config: `.release-it.json`
- Local dry run: `npm run release:dry-run`
- Publish: `npm run release`

## License

MIT

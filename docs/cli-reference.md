# CLI Reference

## Usage

```
pack-config-diff --left=<file> --right=<file> [options]
```

## Required options

### `--left=<file>`

Path to the first config file (the "before" or "baseline").

### `--right=<file>`

Path to the second config file (the "after" or "target").

Both accept `.js`, `.ts`, `.json`, `.yaml`, or `.yml` files. See [Input Formats](./input-formats.md).

## Output options

### `--format=<format>`

Output format. Default: `detailed`.

| Format | Description |
|--------|-------------|
| `detailed` | Human-readable with descriptions, impact notes, and doc links |
| `summary` | One-line count: `3 changes: +1 -0 ~2` |
| `json` | Machine-readable JSON with metadata |
| `yaml` | Machine-readable YAML with metadata |
| `markdown` | GitHub-flavored markdown table for PR comments |

See [Output Formats](./output-formats.md) for examples of each.

### `--output=<file>`

Write output to a file instead of stdout.

```bash
pack-config-diff --left=a.json --right=b.json --format=markdown --output=diff-report.md
```

## Comparison options

### `--plugin-aware`

Compare plugin class instances by their constructor name and property values instead of by object reference. Without this flag, two `new MiniCssExtractPlugin({ filename: "style.css" })` instances in different files always show as "changed" even if they have identical options.

See [Comparison Modes: Plugin-Aware](./comparison-modes.md#plugin-aware-mode).

### `--match-rules-by-test`

Match `module.rules` entries by their `test` pattern instead of by array position. This eliminates false positives when rules are reordered but otherwise identical.

See [Comparison Modes: Rule Matching](./comparison-modes.md#match-rules-by-test).

### `--include-unchanged`

Include unchanged values in the output. By default, only differences are shown.

### `--max-depth=<number>`

Limit comparison depth. Default: unlimited. Useful for focusing on top-level changes:

```bash
pack-config-diff --left=a.json --right=b.json --max-depth=2
```

### `--ignore-keys=<keys>`

Comma-separated list of object keys to ignore everywhere in the config:

```bash
# Ignore all "devServer" and "stats" keys at any depth
pack-config-diff --left=a.json --right=b.json --ignore-keys=devServer,stats
```

### `--ignore-paths=<paths>`

Comma-separated list of dot-separated paths to ignore. Supports `*` wildcards:

```bash
# Ignore all plugin entries and the devServer object
pack-config-diff --left=a.json --right=b.json --ignore-paths="plugins.*,devServer"
```

### `--no-normalize-paths`

Disable automatic path normalization. By default, the tool detects absolute filesystem paths in configs and converts them to relative paths so that configs from different machines are comparable.

See [Comparison Modes: Path Normalization](./comparison-modes.md#path-normalization).

### `--path-separator=<sep>`

Change the separator used in human-readable paths. Default: `.`

```bash
# Use / instead of . for paths like "output/filename"
pack-config-diff --left=a.json --right=b.json --path-separator=/
```

## Other options

### `--help`, `-h`

Show help text and exit.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | No differences found |
| `1` | Differences found, or an error occurred |

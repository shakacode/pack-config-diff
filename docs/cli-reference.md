# CLI Reference

## Usage

```bash
pack-config-diff diff --left=<file> --right=<file> [options]
pack-config-diff --left=<file> --right=<file> [options]
pack-config-diff dump <config-file> [options]
pack-config-diff dump --build=<name> [options]
pack-config-diff dump --all-builds [options]
pack-config-diff dump --list-builds [options]
```

`diff` is the default command when the first argument is a flag (for example, `--left=...`).

## `diff` required options

### `--left=<file>`

Path to the first config file (the "before" or "baseline").

### `--right=<file>`

Path to the second config file (the "after" or "target").

Both accept `.js`, `.ts`, `.json`, `.yaml`, or `.yml` files. See [Input Formats](./input-formats.md).

## `diff` output options

### `--format=<format>`

Output format. Default: `detailed`.

| Format     | Description                                                   |
| ---------- | ------------------------------------------------------------- |
| `detailed` | Human-readable with descriptions, impact notes, and doc links |
| `summary`  | One-line count: `3 changes: +1 -0 ~2`                         |
| `json`     | Machine-readable JSON with metadata                           |
| `yaml`     | Machine-readable YAML with metadata                           |
| `markdown` | GitHub-flavored markdown table for PR comments                |

See [Output Formats](./output-formats.md) for examples of each.

### `--output=<file>`

Write output to a file instead of stdout.

```bash
pack-config-diff --left=a.json --right=b.json --format=markdown --output=diff-report.md
```

## `diff` comparison options

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

## `dump` options

### `dump <config-file>`

Path to the config file to load and serialize. Accepts `.js`, `.ts`, `.json`, `.yaml`, `.yml`.

### `--format=<format>`

Output format. Default: `yaml`.

| Format    | Description                                                        |
| --------- | ------------------------------------------------------------------ |
| `yaml`    | Human-readable YAML with metadata header                           |
| `json`    | JSON payload `{ metadata, config }` with special-type placeholders |
| `inspect` | Node.js `util.inspect` output with metadata and config sections    |

### `--output=<file>`

Write dump output to a file instead of stdout.

### `--save-dir=<dir>`

Write split dump outputs to a directory.

### `--annotate`

Add inline docs for known webpack keys (YAML only).

### `--bundler=<name>`

Set metadata bundler label. Default: `webpack`.

### `--environment=<name>`

Set metadata environment label. Default: `production`.

### `--config-type=<type>`

Set metadata config type label. Default: `client`.

### `--app-root=<path>`

Root directory used to relativize absolute paths in serialized output. Default: current working directory.

### `--env=<KEY=VALUE>`

Set an environment variable before loading the config. Repeatable.

### `--clean`

Strip noisy plugin internals and compact function sources before serializing.

## Build matrix options (`dump`)

### `--config-file=<file>`

Path to build matrix YAML file. Default: `config/pack-config-diff-builds.yml`.

Security note: this file is treated as trusted input. Relative `config:` paths inside the matrix must stay within the current working directory; use absolute paths when you intentionally need to load a config outside the project tree.

### `--build=<name>`

Dump a specific named build from the build matrix.

### `--all-builds`

Dump all builds from the matrix. Writes files to `--save-dir` (or default `pack-config-diff-exports`).

### `--list-builds`

List available builds in the matrix and exit.

## Exit codes

| Code | Meaning                                                                             |
| ---- | ----------------------------------------------------------------------------------- |
| `0`  | Success (`diff`: no changes found; `dump`: export succeeded; or `--help` displayed) |
| `1`  | Differences found (`diff`)                                                          |
| `2`  | Error (invalid arguments, missing files, etc.)                                      |

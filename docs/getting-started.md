# Getting Started

## What does this tool do?

`pack-config-diff` compares two webpack or rspack configuration objects and tells you what's different between them. It understands webpack semantics — so instead of just showing raw JSON diffs, it explains what each change means, links to docs, and warns about potential impact.

## What are "left" and "right"?

The tool compares two config files. By convention:

- **`--left`** is the "before" or "baseline" config (e.g., development, old version, local build)
- **`--right`** is the "after" or "target" config (e.g., production, new version, CI build)

The labels in the output are derived from the filenames. For example, `--left=webpack.dev.js` labels that side as "dev".

## What counts as a config file?

A config file is anything that ultimately represents a **webpack/rspack configuration object** — the same kind of object you'd pass to `webpack()` or export from `webpack.config.js`. The tool supports four file formats:

| Format | Extensions | How it's loaded |
|--------|-----------|-----------------|
| **JavaScript** | `.js` | `require()`'d — can export an object or a function |
| **TypeScript** | `.ts` | Same as JS, but needs `ts-node` installed |
| **JSON** | `.json` | Parsed with `JSON.parse()` |
| **YAML** | `.yaml`, `.yml` | Parsed with `js-yaml` |

See [Input Formats](./input-formats.md) for detailed examples of each.

## Quick example

Given two simple JSON config files:

**dev.json**
```json
{
  "mode": "development",
  "optimization": { "minimize": false }
}
```

**prod.json**
```json
{
  "mode": "production",
  "optimization": { "minimize": true }
}
```

Run:

```bash
pack-config-diff --left=dev.json --right=prod.json
```

Output:

```text
================================================================================
Webpack/Rspack Configuration Comparison
================================================================================

Comparing: dev.json
      vs:  prod.json

Found 2 difference(s): 0 added, 0 removed, 2 changed

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

2. [~] optimization.minimize

   What it does:
   Enable/disable minification of JavaScript bundles.

   Affects: Bundle size and build time

   Default: true in production, false in development

   Values:
     dev:  false
     prod: true

   Impact: Code will be minified - smaller bundles but slower builds

   Documentation: https://webpack.js.org/configuration/optimization/#optimizationminimize

================================================================================

Legend:
  [+] = Added in prod
  [-] = Removed from prod
  [~] = Changed between configs
```

## Common use cases

| Scenario | Command |
|----------|---------|
| Why does this work in dev but break in prod? | `pack-config-diff --left=webpack.dev.js --right=webpack.prod.js` |
| What changed after upgrading a dependency? | `pack-config-diff --left=before.json --right=after.json` |
| Are webpack and rspack configs equivalent? | `pack-config-diff --left=webpack.config.js --right=rspack.config.js` |
| Generate a diff for a PR comment | `pack-config-diff --left=base.json --right=head.json --format=markdown` |

## Next steps

- [Input Formats](./input-formats.md) — how to provide config files in JS, TS, JSON, or YAML
- [CLI Reference](./cli-reference.md) — all options and flags
- [Output Formats](./output-formats.md) — choosing between detailed, summary, json, yaml, and markdown
- [Comparison Modes](./comparison-modes.md) — plugin-aware mode, rule matching, path normalization
- [Programmatic API](./programmatic-api.md) — using pack-config-diff from Node.js code

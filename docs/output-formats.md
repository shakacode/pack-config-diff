# Output Formats

Use `--format=<format>` to control the output. Default is `detailed`.

## `detailed` (default)

Human-readable output with semantic descriptions, impact notes, and links to webpack docs.

```bash
pack-config-diff --left=dev.json --right=prod.json
```

```text
================================================================================
Webpack/Rspack Configuration Comparison
================================================================================

Comparing: dev.json
      vs:  prod.json

Found 3 difference(s): 1 added, 0 removed, 2 changed

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

2. [+] target

   What it does:
   Deployment target environment: 'web', 'node', 'electron-main', etc.

   Affects: Which environment-specific features are enabled

   Default: 'web'

   Values:
     dev:  <not set>
     prod: "web"

   Documentation: https://webpack.js.org/configuration/target/

3. [~] optimization.minimize

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

## `summary`

A single-line count of changes. Best for CI scripts that just need a pass/fail.

```bash
pack-config-diff --left=dev.json --right=prod.json --format=summary
```

```text
3 changes: +1 -0 ~2
```

When configs are identical:

```text
✅ No differences found
```

## `json`

Structured JSON for machine consumption. Includes metadata, summary counts, and full change entries.

```bash
pack-config-diff --left=dev.json --right=prod.json --format=json
```

```json
{
  "summary": {
    "totalChanges": 2,
    "added": 0,
    "removed": 0,
    "changed": 2
  },
  "entries": [
    {
      "operation": "changed",
      "path": {
        "path": ["mode"],
        "humanPath": "mode"
      },
      "oldValue": "development",
      "newValue": "production",
      "valueType": "string"
    },
    {
      "operation": "changed",
      "path": {
        "path": ["optimization", "minimize"],
        "humanPath": "optimization.minimize"
      },
      "oldValue": false,
      "newValue": true,
      "valueType": "boolean"
    }
  ],
  "metadata": {
    "comparedAt": "2026-03-15T18:30:00.000Z",
    "leftFile": "dev.json",
    "rightFile": "prod.json"
  }
}
```

## `yaml`

The YAML formatter restructures the data into `metadata`, `summary`, and `changes` (grouped by operation type: added, removed, changed, unchanged). This differs from the JSON format which uses a flat `entries` array:

```bash
pack-config-diff --left=dev.json --right=prod.json --format=yaml
```

```yaml
metadata:
  comparedAt: "2026-03-15T18:30:00.000Z"
  leftFile: dev.json
  rightFile: prod.json
summary:
  totalChanges: 2
  added: 0
  removed: 0
  changed: 2
changes:
  added: []
  removed: []
  changed:
    - operation: changed
      path:
        path: [mode]
        humanPath: mode
      oldValue: development
      newValue: production
```

## `markdown`

A GitHub-flavored markdown table, ready to paste into a PR comment or save as a build artifact.

```bash
pack-config-diff --left=dev.json --right=prod.json --format=markdown
```

```markdown
## pack-config-diff report

Comparing `dev.json` vs `prod.json`

**Summary:** 2 change(s) (+0 / -0 / ~2)

| #   | Op  | Path                    | dev           | prod         |
| --- | --- | ----------------------- | ------------- | ------------ |
| 1   | ~   | `mode`                  | "development" | "production" |
| 2   | ~   | `optimization.minimize` | false         | true         |
```

### Writing markdown to a file for CI

```bash
pack-config-diff \
  --left=baseline.json \
  --right=current.json \
  --format=markdown \
  --output=diff-report.md
```

You can then post `diff-report.md` as a PR comment using `gh pr comment` or as a CI artifact.

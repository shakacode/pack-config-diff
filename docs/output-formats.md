# Output Formats

Use `--format=<format>` to control the output. Default is `detailed`.

## `detailed` (default)

Human-readable output with semantic descriptions, impact notes, and links to webpack docs.

```bash
pack-config-diff --left=dev.json --right=prod.json
```

```
pack-config-diff — Semantic config diff
Comparing: dev.json ↔ prod.json
Found 3 difference(s): 1 added, 0 removed, 2 changed

1. [~] mode
   Description: Sets webpack optimization defaults for development or production.
   Affects: Minification, tree-shaking, and debug ergonomics
   Default: production
   dev: "development"
   prod: "production"
   Impact: Switching mode from development to production changes optimization defaults and debugging behavior.
   Docs: https://webpack.js.org/configuration/mode/

2. [~] optimization.minimize
   Description: Enables or disables code minimization.
   Affects: Bundle size and build time
   Default: true in production
   dev: false
   prod: true
   Impact: Minification is now enabled, usually reducing bundle size at the cost of build time.
   Docs: https://webpack.js.org/configuration/optimization/#optimizationminimize

3. [+] target
   Description: Defines target runtime environment for output bundles.
   prod: "web"
   Docs: https://webpack.js.org/configuration/target/

Legend: [+] added, [-] removed, [~] changed
```

## `summary`

A single-line count of changes. Best for CI scripts that just need a pass/fail.

```bash
pack-config-diff --left=dev.json --right=prod.json --format=summary
```

```
3 changes: +1 -0 ~2
```

When configs are identical:

```
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

Same structure as `json` but in YAML. Useful if your tooling prefers YAML:

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

| # | Op | Path | dev | prod |
| --- | --- | --- | --- | --- |
| 1 | ~ | `mode` | "development" | "production" |
| 2 | ~ | `optimization.minimize` | false | true |
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

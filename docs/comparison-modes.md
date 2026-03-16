# Comparison Modes

Beyond basic key-by-key diffing, `pack-config-diff` has three features that reduce noise and make comparisons more meaningful.

## Plugin-aware mode

**Flag:** `--plugin-aware`

### The problem

Webpack plugins are class instances. When two configs each instantiate the same plugin with the same options, a naive comparison sees them as different objects:

```javascript
// left.js
module.exports = { plugins: [new MiniCssExtractPlugin({ filename: "style.css" })] }

// right.js
module.exports = { plugins: [new MiniCssExtractPlugin({ filename: "style.css" })] }
```

Without `--plugin-aware`:
```
1 changes: +0 -0 ~1
```

The tool reports a change even though both plugins are functionally identical.

### The solution

With `--plugin-aware`, the tool compares plugin instances by:

1. Checking that the constructor is the same class
2. Comparing all instance properties recursively (serializing functions, RegExps, etc.)

```bash
pack-config-diff --left=left.js --right=right.js --plugin-aware
```

```
✅ No differences found
```

### When to use it

- When comparing JS/TS configs that use `new Plugin(...)` instances
- When debugging plugin option differences across environments
- Not needed for JSON/YAML configs (they can't contain class instances)

### When plugins genuinely differ

If the options are different, the diff surfaces the actual property changes:

```javascript
// left.js — development
module.exports = {
  plugins: [new MiniCssExtractPlugin({ filename: "[name].css" })]
}

// right.js — production
module.exports = {
  plugins: [new MiniCssExtractPlugin({ filename: "[name]-[contenthash].css" })]
}
```

```bash
pack-config-diff --left=left.js --right=right.js --plugin-aware
```

```
1. [~] plugins.[0].filename
   left: "[name].css"
   right: "[name]-[contenthash].css"
```

## Match rules by test

**Flag:** `--match-rules-by-test`

### The problem

`module.rules` is an array, so by default rules are compared by index position. If you reorder rules without changing their content, you get false positives:

```json
// left.json
{
  "module": {
    "rules": [
      { "test": "\\.js$", "use": "babel-loader" },
      { "test": "\\.css$", "use": "css-loader" }
    ]
  }
}
```

```json
// right.json (same rules, swapped order)
{
  "module": {
    "rules": [
      { "test": "\\.css$", "use": "css-loader" },
      { "test": "\\.js$", "use": "babel-loader" }
    ]
  }
}
```

Without `--match-rules-by-test`:
```
4 changes: +0 -0 ~4
```

Four spurious changes because rules[0] and rules[1] swapped positions.

### The solution

With `--match-rules-by-test`, rules are matched by their `test` pattern instead of array index. Rules with the same `test` value are paired together for comparison:

```bash
pack-config-diff --left=left.json --right=right.json --match-rules-by-test
```

```
✅ No differences found
```

### How matching works

- Each rule's `test` property (string or RegExp) is used as its identity
- Rules without a `test` property fall back to index-based matching
- Duplicate `test` values are handled with occurrence counters

### When to use it

- When comparing configs that may have reordered rules
- When you only care about the content of each rule, not its position
- Particularly useful during refactoring or when merging config fragments from different sources

## Path normalization

**Enabled by default.** Disable with `--no-normalize-paths`.

### The problem

Webpack configs often contain absolute filesystem paths (e.g., `output.path`). When comparing configs generated on different machines, these paths differ even though the project structure is identical:

```json
// left.json (Alice's machine)
{ "output": { "path": "/Users/alice/project/public/packs" } }

// right.json (Bob's machine)
{ "output": { "path": "/home/bob/project/public/packs" } }
```

Without normalization:
```
1 changes: +0 -0 ~1
```

### The solution

Path normalization automatically detects absolute paths in the config, finds the common project root, and converts paths to relative form before comparing:

```bash
pack-config-diff --left=left.json --right=right.json
```

```
✅ No differences found
```

Both paths resolve to `./public/packs` relative to their respective project roots.

### Disabling normalization

If you specifically care about absolute path differences:

```bash
pack-config-diff --left=left.json --right=right.json --no-normalize-paths
```

```
1 changes: +0 -0 ~1

1. [~] output.path
   left: "/Users/alice/project/public/packs"
   right: "/home/bob/project/public/packs"
```

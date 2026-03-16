# Input Formats

`pack-config-diff` accepts config files in four formats. Each file should contain a webpack or rspack configuration object — the same shape you'd pass to `webpack()`.

You can mix formats freely: `--left=config.yaml --right=webpack.config.js` works fine.

## JavaScript (`.js`)

Point `--left` or `--right` at any `.js` file that exports a webpack config. The tool loads it with `require()`, so CommonJS modules work out of the box.

### Static export

```javascript
// webpack.dev.js
module.exports = {
  mode: "development",
  output: {
    filename: "bundle.js",
    path: "/Users/alice/project/public/packs"
  },
  optimization: {
    minimize: false
  }
}
```

### Function export

If your config exports a function (common with webpack's `--env` support), the tool calls it automatically with `({}, { mode: "production" })`:

```javascript
// webpack.config.js
module.exports = (env, argv) => ({
  mode: argv.mode || "development",
  output: {
    filename: argv.mode === "production" ? "[name]-[contenthash].js" : "[name].js"
  }
})
```

### ES module default export

If the module uses `export default`, the tool resolves it:

```javascript
// webpack.config.js
export default {
  mode: "production"
}
```

### With real plugins

JS files can use actual plugin class instances. Combine with `--plugin-aware` to compare plugins by their options instead of by object reference (see [Comparison Modes](./comparison-modes.md)):

```javascript
// webpack.prod.js
const MiniCssExtractPlugin = require("mini-css-extract-plugin")

module.exports = {
  mode: "production",
  plugins: [
    new MiniCssExtractPlugin({ filename: "[name]-[contenthash].css" })
  ]
}
```

```bash
pack-config-diff --left=webpack.dev.js --right=webpack.prod.js --plugin-aware
```

## TypeScript (`.ts`)

Works identically to JavaScript, but requires `ts-node` as a peer dependency:

```bash
npm install --save-dev ts-node
```

```typescript
// webpack.config.ts
import type { Configuration } from "webpack"

const config: Configuration = {
  mode: "production",
  output: { filename: "[name]-[contenthash].js" }
}

export default config
```

## JSON (`.json`)

A plain JSON file representing the config object. Useful when you've serialized a resolved config with `JSON.stringify()`:

```json
{
  "mode": "production",
  "output": {
    "filename": "[name]-[contenthash].js",
    "path": "/home/bob/project/public/packs"
  },
  "optimization": {
    "minimize": true,
    "splitChunks": {
      "chunks": "all"
    }
  }
}
```

### How to create a JSON config dump

You can dump a resolved webpack config from Node.js:

```javascript
// dump-config.js
const config = require("./webpack.config.js")
const resolved = typeof config === "function" ? config({}, { mode: "production" }) : config
const fs = require("fs")
fs.writeFileSync("webpack-resolved.json", JSON.stringify(resolved, null, 2))
```

Or from a Shakapacker project:

```bash
RAILS_ENV=production bundle exec rails runner \
  "puts JSON.pretty_generate(Shakapacker::Compiler.new.send(:webpack_config))" \
  > webpack-production.json
```

## YAML (`.yaml`, `.yml`)

YAML is often the most readable format for config snapshots. The structure is the same as JSON — just YAML syntax:

```yaml
mode: production
output:
  filename: "[name]-[contenthash].js"
  path: /home/bob/project/public/packs
optimization:
  minimize: true
  splitChunks:
    chunks: all
module:
  rules:
    - test: "\\.js$"
      use: babel-loader
    - test: "\\.css$"
      use:
        - style-loader
        - css-loader
```

### Where do YAML config files come from?

YAML configs are **not** something webpack reads natively. They're snapshots that you or your framework generates for inspection. Common sources:

- **Shakapacker** exports the resolved webpack config as YAML for debugging
- **Manual export**: convert a JS config to YAML for easier reading or version control
- **CI pipelines**: dump and archive resolved configs as build artifacts

The key thing to understand: a YAML config file contains the same data as a `webpack.config.js` export — it's just a different serialization format. A YAML file like:

```yaml
mode: production
output:
  filename: bundle.js
```

is equivalent to a JS file that exports:

```javascript
module.exports = {
  mode: "production",
  output: { filename: "bundle.js" }
}
```

## Limitations by format

| Capability | JS/TS | JSON | YAML |
|-----------|-------|------|------|
| Static config objects | Yes | Yes | Yes |
| Function exports (dynamic configs) | Yes | No | No |
| Plugin class instances (`new Plugin()`) | Yes | No | No |
| Regular expressions (`/\.js$/`) | Yes | No (string only) | No (string only) |
| Functions in config (minimizers, etc.) | Yes | No | No |

If your config uses plugins or functions, prefer JS files for the most accurate comparison. JSON and YAML are best for comparing the plain data portions of resolved configs.

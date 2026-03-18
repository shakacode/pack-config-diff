import fs from "fs"
import path from "path"

import yaml from "js-yaml"

export function resolveExportedConfig(moduleExports: unknown): unknown {
  if (typeof moduleExports === "function") {
    return (moduleExports as (env?: unknown, argv?: unknown) => unknown)({}, { mode: "production" })
  }

  return moduleExports
}

export function loadJsLikeConfig(absolutePath: string): unknown {
  const resolvedModulePath = require.resolve(absolutePath)
  delete require.cache[resolvedModulePath]

  const moduleExports = require(resolvedModulePath)
  const config = moduleExports?.default ?? moduleExports

  return resolveExportedConfig(config)
}

export function loadConfigFile(filePath: string): unknown {
  const absolutePath = path.resolve(filePath)
  const extension = path.extname(absolutePath).toLowerCase()

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${filePath}`)
  }

  switch (extension) {
    case ".json": {
      const content = fs.readFileSync(absolutePath, "utf8")
      return JSON.parse(content)
    }
    case ".yaml":
    case ".yml": {
      const content = fs.readFileSync(absolutePath, "utf8")
      return yaml.load(content)
    }
    case ".js":
      return loadJsLikeConfig(absolutePath)
    case ".ts":
      try {
        require("ts-node/register/transpile-only")
      } catch (_error) {
        throw new Error(
          `Cannot load TypeScript config (${filePath}): ts-node is required. Install it with \"npm install --save-dev ts-node\".`
        )
      }

      return loadJsLikeConfig(absolutePath)
    default:
      throw new Error(`Unsupported file extension: ${extension || "(none)"}`)
  }
}

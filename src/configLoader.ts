import fs from "fs";
import path from "path";

import yaml from "js-yaml";

export function resolveExportedConfig(
  moduleExports: unknown,
  mode: string = "production",
): unknown {
  if (typeof moduleExports === "function") {
    return (moduleExports as (env?: unknown, argv?: unknown) => unknown)({}, { mode });
  }

  return moduleExports;
}

function clearRequireCache(moduleId: string, seen = new Set<string>()): void {
  const cachedModule = require.cache[moduleId];
  if (!cachedModule || seen.has(moduleId)) {
    return;
  }

  seen.add(moduleId);
  for (const child of cachedModule.children) {
    if (!child.id.includes(`${path.sep}node_modules${path.sep}`)) {
      clearRequireCache(child.id, seen);
    }
  }

  delete require.cache[moduleId];
}

export function loadJsLikeConfig(absolutePath: string, mode: string = "production"): unknown {
  const resolvedModulePath = require.resolve(absolutePath);
  clearRequireCache(resolvedModulePath);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const moduleExports = require(resolvedModulePath);
  const config = moduleExports?.default ?? moduleExports;

  return resolveExportedConfig(config, mode);
}

export function loadConfigFile(filePath: string, mode: string = "production"): unknown {
  const absolutePath = path.resolve(filePath);
  const extension = path.extname(absolutePath).toLowerCase();

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  switch (extension) {
    case ".json": {
      const content = fs.readFileSync(absolutePath, "utf8");
      return JSON.parse(content);
    }
    case ".yaml":
    case ".yml": {
      const content = fs.readFileSync(absolutePath, "utf8");
      // Use CORE_SCHEMA to allow standard scalars (booleans, numbers, null) while
      // blocking unsafe tags like !!js/function. FAILSAFE_SCHEMA (used in
      // buildConfigFile.ts) is too strict here since webpack YAML configs may
      // legitimately contain booleans and numbers.
      return yaml.load(content, { schema: yaml.CORE_SCHEMA });
    }
    case ".js":
      return loadJsLikeConfig(absolutePath, mode);
    case ".ts":
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("ts-node/register/transpile-only");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Cannot find module")) {
          // eslint-disable-next-line preserve-caught-error -- Error.cause requires ES2022+
          throw new Error(
            `Cannot load TypeScript config (${filePath}): ts-node is required. Install it with "npm install --save-dev ts-node".`,
          );
        }

        // eslint-disable-next-line preserve-caught-error -- Error.cause requires ES2022+
        throw new Error(`Cannot load TypeScript config (${filePath}): ${message}`);
      }

      return loadJsLikeConfig(absolutePath, mode);
    default:
      throw new Error(`Unsupported file extension: ${extension || "(none)"}`);
  }
}

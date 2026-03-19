import { isAbsolute, relative } from "path"

function makePathRelative(str: string, rootPath: string): string {
  if (!isAbsolute(str) || !isAbsolute(rootPath)) {
    return str
  }

  const rel = relative(rootPath, str)

  if (rel === "") {
    return "."
  }

  if (rel.startsWith("..") || isAbsolute(rel)) {
    return str
  }

  return `./${rel}`
}

function getConstructorName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const constructorValue = (value as { constructor?: { name?: string } }).constructor
  return constructorValue?.name
}

function cleanValue(value: unknown, rootPath: string, key?: string, parent?: unknown): unknown {
  const parentConstructor = getConstructorName(parent)

  if (parentConstructor === "EnvironmentPlugin" && (key === "keys" || key === "defaultValues")) {
    return undefined
  }

  if (parentConstructor === "DefinePlugin" && key === "definitions") {
    return "[FILTERED]"
  }

  if (typeof value === "function") {
    const source = value.toString()
    return source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join(" ")
  }

  if (value instanceof RegExp) {
    return value
  }

  if (typeof value === "string") {
    return makePathRelative(value, rootPath)
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => cleanValue(item, rootPath, String(index), value))
  }

  if (value && typeof value === "object") {
    const cleaned: Record<string, unknown> = {}
    for (const objectKey in value) {
      if (!Object.prototype.hasOwnProperty.call(value, objectKey)) {
        continue
      }

      const nested = (value as Record<string, unknown>)[objectKey]
      const cleanedValue = cleanValue(nested, rootPath, objectKey, value)
      if (cleanedValue !== undefined) {
        cleaned[objectKey] = cleanedValue
      }
    }

    return cleaned
  }

  return value
}

export function cleanConfig(config: unknown, rootPath: string): unknown {
  return cleanValue(config, rootPath)
}

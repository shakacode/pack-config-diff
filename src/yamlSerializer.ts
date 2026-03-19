import { relative, isAbsolute } from "path"

import { getDocDescription } from "./configDocs"
import type { DumpMetadata } from "./types"

const YAML_AMBIGUOUS_SCALAR =
  /^(~|null|true|false|yes|no|on|off|y|n)$/i

const YAML_NUMERIC =
  /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$|^0x[0-9a-fA-F]+$|^0o[0-7]+$|^[-+]?(\.inf|\.Inf|\.INF)$|^(\.nan|\.NaN|\.NAN)$/

function needsYamlQuoting(value: string): boolean {
  return YAML_AMBIGUOUS_SCALAR.test(value) || YAML_NUMERIC.test(value)
}

export class YamlSerializer {
  private annotate: boolean
  private appRoot: string

  constructor(options: { annotate: boolean; appRoot: string }) {
    this.annotate = options.annotate
    this.appRoot = options.appRoot
  }

  serialize(config: unknown, metadata: DumpMetadata): string {
    const output: string[] = []

    output.push(YamlSerializer.createHeader(metadata))
    output.push("")
    output.push(this.serializeValue(config, 0, ""))

    return output.join("\n")
  }

  private static createHeader(metadata: DumpMetadata): string {
    const lines: string[] = []
    lines.push(`# ${"=".repeat(77)}`)
    lines.push("# Webpack/Rspack Configuration Export")
    lines.push(`# Generated: ${metadata.exportedAt}`)
    lines.push(`# Environment: ${metadata.environment}`)
    lines.push(`# Bundler: ${metadata.bundler}`)
    lines.push(`# Config Type: ${metadata.configType}`)
    if (metadata.configCount > 1) {
      lines.push(`# Total Configs: ${metadata.configCount}`)
    }
    lines.push(`# ${"=".repeat(77)}`)
    return lines.join("\n")
  }

  private serializeValue(value: unknown, indent: number, keyPath: string): string {
    if (value === null || value === undefined) {
      return "null"
    }

    if (typeof value === "boolean") {
      return value.toString()
    }

    if (typeof value === "number") {
      return value.toString()
    }

    if (typeof value === "string") {
      return this.serializeString(value, indent)
    }

    if (typeof value === "function") {
      return this.serializeFunction(value as (...args: unknown[]) => unknown, indent)
    }

    if (value instanceof RegExp) {
      const regexStr = value.toString()
      const lastSlash = regexStr.lastIndexOf("/")
      const pattern = regexStr.slice(1, lastSlash)
      const flags = regexStr.slice(lastSlash + 1)

      const serializedPattern = this.serializeString(pattern, indent)
      if (flags) {
        return `${serializedPattern} # flags: ${flags}`
      }

      return serializedPattern
    }

    if (Array.isArray(value)) {
      return this.serializeArray(value, indent, keyPath)
    }

    if (typeof value === "object") {
      return this.serializeObject(value as Record<string, unknown>, indent, keyPath)
    }

    if (typeof value === "symbol") {
      return value.toString()
    }

    if (typeof value === "bigint") {
      return value.toString()
    }

    return String(value as string | number | boolean | null | undefined)
  }

  private serializeString(str: string, indent = 0): string {
    const cleaned = this.makePathRelative(str)

    if (cleaned.includes("\n")) {
      const lines = cleaned.split("\n")
      const lineIndent = " ".repeat(indent + 2)
      return `|\n${lines.map((line) => lineIndent + line).join("\n")}`
    }

    if (
      cleaned === "" ||
      needsYamlQuoting(cleaned) ||
      cleaned.includes(":") ||
      cleaned.includes("#") ||
      cleaned.includes("'") ||
      cleaned.includes('"') ||
      cleaned.includes("[") ||
      cleaned.includes("]") ||
      cleaned.includes("{") ||
      cleaned.includes("}") ||
      cleaned.includes("*") ||
      cleaned.includes("&") ||
      cleaned.includes("!") ||
      cleaned.includes("@") ||
      cleaned.includes("`") ||
      cleaned.startsWith(" ") ||
      cleaned.endsWith(" ")
    ) {
      return `"${cleaned.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    }

    return cleaned
  }

  private serializeFunction(fn: (...args: unknown[]) => unknown, indent = 0): string {
    const source = fn.toString()
    const lines = source.split("\n")

    const maxLines = 50
    const truncated = lines.length > maxLines
    const displayLines = truncated ? lines.slice(0, maxLines) : lines

    const indentLevels = displayLines
      .filter((line) => line.trim().length > 0)
      .map((line) => line.match(/^\s*/)?.[0].length || 0)
    const minIndent = indentLevels.length > 0 ? Math.min(...indentLevels) : 0

    const formatted =
      displayLines.map((line) => line.substring(minIndent)).join("\n") +
      (truncated ? "\n..." : "")

    return this.serializeString(formatted, indent)
  }

  private serializeArray(arr: unknown[], indent: number, keyPath: string): string {
    if (arr.length === 0) {
      return "[]"
    }

    const lines: string[] = []
    const itemIndent = " ".repeat(indent + 2)
    const contentIndent = " ".repeat(indent + 4)

    arr.forEach((item, index) => {
      const itemPath = `${keyPath}[${index}]`

      const pluginName = YamlSerializer.getConstructorName(item)
      const isPlugin = pluginName && /(^|\.)plugins\[\d+\]/.test(itemPath)
      const isEmpty =
        typeof item === "object" &&
        item !== null &&
        !Array.isArray(item) &&
        Object.keys(item).length === 0

      if (isPlugin && !isEmpty) {
        lines.push(`${itemIndent}# ${pluginName}`)
      }

      const serialized = this.serializeValue(item, indent + 4, itemPath)

      if (this.annotate) {
        const doc = getDocDescription(itemPath)
        if (doc) {
          lines.push(`${itemIndent}# ${doc}`)
        }
      }

      if (
        (typeof item === "object" && !Array.isArray(item) && item !== null) ||
        serialized.includes("\n")
      ) {
        lines.push(`${itemIndent}-`)
        const nonEmptyLines = serialized
          .split("\n")
          .filter((line) => line.trim().length > 0)
        const indentLevels = nonEmptyLines.map(
          (line) => line.match(/^\s*/)?.[0].length || 0
        )
        const minIndent = indentLevels.length > 0 ? Math.min(...indentLevels) : 0
        nonEmptyLines.forEach((line) => {
          lines.push(contentIndent + line.substring(minIndent))
        })
      } else {
        lines.push(`${itemIndent}- ${serialized}`)
      }
    })

    return `\n${lines.join("\n")}`
  }

  private serializeObject(obj: Record<string, unknown>, indent: number, keyPath: string): string {
    const keys = Object.keys(obj).sort()
    const constructorName = YamlSerializer.getConstructorName(obj)

    if (keys.length === 0) {
      if (constructorName) {
        return `{} # ${constructorName}`
      }
      return "{}"
    }

    const lines: string[] = []
    const keyIndent = " ".repeat(indent)
    const valueIndent = " ".repeat(indent + 2)

    keys.forEach((key) => {
      const value = obj[key]
      const fullKeyPath = keyPath ? `${keyPath}.${key}` : key
      const safeKey = YamlSerializer.quoteKey(key)

      if (this.annotate) {
        const doc = getDocDescription(fullKeyPath)
        if (doc) {
          lines.push(`${keyIndent}# ${doc}`)
        }
      }

      if (typeof value === "string" && value.includes("\n")) {
        lines.push(`${keyIndent}${safeKey}: |`)
        for (const line of value.split("\n")) {
          lines.push(`${valueIndent}${line}`)
        }
      } else if (value instanceof RegExp || typeof value === "function") {
        const serialized = this.serializeValue(value, indent + 2, fullKeyPath)
        lines.push(`${keyIndent}${safeKey}: ${serialized}`)
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        if (Object.keys(value).length === 0) {
          lines.push(`${keyIndent}${safeKey}: {}`)
        } else {
          lines.push(`${keyIndent}${safeKey}:`)
          const nestedLines = this.serializeObject(
            value as Record<string, unknown>,
            indent + 2,
            fullKeyPath
          )
          lines.push(nestedLines)
        }
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${keyIndent}${safeKey}: []`)
        } else {
          lines.push(`${keyIndent}${safeKey}:`)
          const arrayLines = this.serializeArray(value, indent + 2, fullKeyPath)
          lines.push(arrayLines)
        }
      } else {
        const serialized = this.serializeValue(value, indent + 2, fullKeyPath)
        lines.push(`${keyIndent}${safeKey}: ${serialized}`)
      }
    })

    return lines.join("\n")
  }

  private static quoteKey(key: string): string {
    if (
      needsYamlQuoting(key) ||
      key.includes(":") ||
      key.includes("#") ||
      key.includes("[") ||
      key.includes("]") ||
      key.includes("{") ||
      key.includes("}") ||
      key.includes(",") ||
      key.includes("&") ||
      key.includes("*") ||
      key.includes("!") ||
      key.includes("|") ||
      key.includes(">") ||
      key.includes("'") ||
      key.includes('"') ||
      key.includes("%") ||
      key.includes("@") ||
      key.includes("`") ||
      key.startsWith(" ") ||
      key.endsWith(" ") ||
      key === ""
    ) {
      return `"${key.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    }

    return key
  }

  private makePathRelative(str: string): string {
    if (!isAbsolute(str)) {
      return str
    }

    const rel = relative(this.appRoot, str)

    if (rel === "") {
      return "."
    }

    if (rel.startsWith("..") || isAbsolute(rel)) {
      return str
    }

    return `./${rel}`
  }

  private static getConstructorName(obj: unknown): string | null {
    if (!obj || typeof obj !== "object") return null
    if (Array.isArray(obj)) return null

    try {
      const proto = Object.getPrototypeOf(obj) as { constructor?: { name?: string } } | null
      if (!proto || proto === Object.prototype) return null

      const { constructor } = proto
      if (!constructor || typeof constructor !== "function") return null

      const constructorName = constructor.name
      if (!constructorName || constructorName === "Object") return null

      return constructorName
    } catch {
      return null
    }
  }
}

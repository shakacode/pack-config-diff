import os from "os"
import path from "path"

import type { NormalizedConfig } from "./types"

type PathFlavor = "posix" | "win32"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isClassInstance(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false
  }

  if (Array.isArray(value) || value instanceof Date || value instanceof RegExp) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype !== Object.prototype && prototype !== null
}

function detectPathFlavor(input: string): PathFlavor | undefined {
  if (/^[A-Za-z]:[\\/]/.test(input) || /^\\\\/.test(input)) {
    return "win32"
  }

  if (input.startsWith("/")) {
    return "posix"
  }

  if (input.startsWith("\\")) {
    return "win32"
  }

  return undefined
}

function isRelativePath(input: string): boolean {
  return (
    input.startsWith("./") ||
    input.startsWith(".\\") ||
    input.startsWith("../") ||
    input.startsWith("..\\")
  )
}

function expandHomePath(input: string): string {
  if (input !== "~" && !input.startsWith("~/") && !input.startsWith("~\\")) {
    return input
  }

  const home = os.homedir()
  if (input === "~") {
    return home
  }

  return path.join(home, input.slice(2))
}

function getPathModule(flavor: PathFlavor): typeof path.posix | typeof path.win32 {
  return flavor === "win32" ? path.win32 : path.posix
}

function ensureRelativePrefix(input: string, flavor: PathFlavor): string {
  const separator = flavor === "win32" ? "\\" : "/"
  if (input === "" || input === ".") {
    return `.${separator === "\\" ? "\\" : "/"}`
  }

  if (input.startsWith("..")) {
    return input
  }

  if (input.startsWith(".")) {
    return input
  }

  return `.${separator}${input}`
}

function isWithinBase(
  absolutePath: string,
  basePath: string,
  pathModule: typeof path.posix | typeof path.win32
): boolean {
  const relative = pathModule.relative(basePath, absolutePath)
  if (relative === "") {
    return true
  }

  return !relative.startsWith("..") && !pathModule.isAbsolute(relative)
}

function splitSegments(input: string, flavor: PathFlavor): { root: string; segments: string[] } {
  const pathModule = getPathModule(flavor)
  const normalized = pathModule.normalize(input)
  const parsed = pathModule.parse(normalized)
  const rest = normalized.slice(parsed.root.length)
  const segments = rest.split(/[\\/]+/).filter(Boolean)

  return { root: parsed.root, segments }
}

function joinSegments(root: string, segments: string[], flavor: PathFlavor): string {
  const pathModule = getPathModule(flavor)
  if (segments.length === 0) {
    return root
  }

  return pathModule.join(root, ...segments)
}

function toDirectoryCandidate(absolutePath: string, flavor: PathFlavor): string {
  const pathModule = getPathModule(flavor)
  const normalized = pathModule.normalize(absolutePath)
  const ext = pathModule.extname(normalized)

  if (ext.length > 0) {
    return pathModule.dirname(normalized)
  }

  return normalized
}

export class PathNormalizer {
  private readonly basePath: string
  private readonly baseFlavor: PathFlavor
  private readonly basePathModule: typeof path.posix | typeof path.win32

  public constructor(basePath: string = process.cwd()) {
    const expandedBasePath = expandHomePath(basePath)
    const baseFlavor = detectPathFlavor(expandedBasePath) ?? (path.sep === "\\" ? "win32" : "posix")

    this.baseFlavor = baseFlavor
    this.basePathModule = getPathModule(baseFlavor)
    this.basePath = this.basePathModule.resolve(expandedBasePath)
  }

  public normalize(config: unknown): NormalizedConfig {
    return {
      original: config,
      normalized: this.normalizeValue(config),
      basePath: this.basePath
    }
  }

  public static detectBasePath(config: unknown): string | undefined {
    const absolutePathsByFlavor: Record<PathFlavor, string[]> = {
      posix: [],
      win32: []
    }

    const walk = (value: unknown): void => {
      if (typeof value === "string") {
        if (!PathNormalizer.looksLikePath(value)) {
          return
        }

        const expanded = expandHomePath(value)
        const flavor = detectPathFlavor(expanded)
        if (!flavor) {
          return
        }

        const pathModule = getPathModule(flavor)
        if (pathModule.isAbsolute(expanded)) {
          absolutePathsByFlavor[flavor].push(toDirectoryCandidate(expanded, flavor))
        }

        return
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          walk(item)
        }
        return
      }

      if (isPlainObject(value)) {
        for (const nestedValue of Object.values(value)) {
          walk(nestedValue)
        }
      }
    }

    walk(config)

    const flavor: PathFlavor | undefined = (() => {
      if (absolutePathsByFlavor.posix.length === 0 && absolutePathsByFlavor.win32.length === 0) {
        return undefined
      }

      if (absolutePathsByFlavor.posix.length >= absolutePathsByFlavor.win32.length) {
        return "posix"
      }

      return "win32"
    })()

    if (!flavor) {
      return undefined
    }

    const candidates = absolutePathsByFlavor[flavor]
    if (candidates.length === 0) {
      return undefined
    }

    if (candidates.length === 1) {
      return candidates[0]
    }

    const split = candidates.map((candidate) => splitSegments(candidate, flavor))
    const first = split[0]

    const root = first.root
    for (const item of split) {
      if (item.root.toLowerCase() !== root.toLowerCase()) {
        return undefined
      }
    }

    const commonSegments: string[] = []
    const minLength = Math.min(...split.map((item) => item.segments.length))
    for (let index = 0; index < minLength; index += 1) {
      const segment = split[0].segments[index]
      const isShared = split.every((item) => {
        if (flavor === "win32") {
          return item.segments[index].toLowerCase() === segment.toLowerCase()
        }

        return item.segments[index] === segment
      })

      if (!isShared) {
        break
      }

      commonSegments.push(segment)
    }

    return joinSegments(root, commonSegments, flavor)
  }

  private normalizeValue(value: unknown): unknown {
    if (typeof value === "string") {
      return this.normalizeString(value)
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeValue(item))
    }

    if (isClassInstance(value)) {
      return value
    }

    if (isPlainObject(value)) {
      const normalizedObject: Record<string, unknown> = {}
      for (const [key, nestedValue] of Object.entries(value)) {
        normalizedObject[key] = this.normalizeValue(nestedValue)
      }

      return normalizedObject
    }

    return value
  }

  private normalizeString(input: string): string {
    if (!PathNormalizer.looksLikePath(input)) {
      return input
    }

    const expanded = expandHomePath(input)
    const flavor = detectPathFlavor(expanded)

    if (flavor) {
      if (flavor !== this.baseFlavor) {
        return expanded
      }

      const pathModule = getPathModule(flavor)
      const normalizedAbsolutePath = pathModule.normalize(expanded)
      const normalizedBasePath = pathModule.normalize(this.basePath)

      if (!pathModule.isAbsolute(normalizedAbsolutePath)) {
        return expanded
      }

      if (!isWithinBase(normalizedAbsolutePath, normalizedBasePath, pathModule)) {
        return normalizedAbsolutePath
      }

      const relative = pathModule.relative(normalizedBasePath, normalizedAbsolutePath)
      return ensureRelativePrefix(relative, flavor)
    }

    if (!isRelativePath(expanded)) {
      return expanded
    }

    const normalizedRelativePath = this.basePathModule.normalize(expanded)
    return ensureRelativePrefix(normalizedRelativePath, this.baseFlavor)
  }

  private static looksLikePath(input: string): boolean {
    if (input.length < 2 && input !== "~") {
      return false
    }

    if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(input)) {
      return false
    }

    if (/^@[^/\\]+[/\\].+/.test(input)) {
      return false
    }

    return (
      input.startsWith("/") ||
      input.startsWith("\\") ||
      isRelativePath(input) ||
      input === "~" ||
      input.startsWith("~/") ||
      input.startsWith("~\\") ||
      /^[A-Za-z]:[\\/]/.test(input)
    )
  }
}

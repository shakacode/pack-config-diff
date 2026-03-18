import { isAbsolute, relative } from "path"

export function makePathRelative(str: string, rootPath: string): string {
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

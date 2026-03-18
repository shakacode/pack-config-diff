import { existsSync, readFileSync } from "fs"
import path from "path"

import { load as loadYaml, FAILSAFE_SCHEMA } from "js-yaml"

import type { DumpBuildConfigFile, ResolvedDumpBuild } from "./types"

export const DEFAULT_BUILD_CONFIG_FILE = "config/pack-config-diff-builds.yml"

interface BuildSummary {
  name: string
  description?: string
  bundler: "webpack" | "rspack"
  config: string
  outputs: string[]
}

export class BuildConfigFileLoader {
  private readonly configFilePath: string

  constructor(configFilePath: string = DEFAULT_BUILD_CONFIG_FILE) {
    this.configFilePath = path.resolve(configFilePath)
    this.validateConfigPath()
  }

  get filePath(): string {
    return this.configFilePath
  }

  exists(): boolean {
    return existsSync(this.configFilePath)
  }

  load(): DumpBuildConfigFile {
    if (!this.exists()) {
      throw new Error(`Build config file not found: ${this.configFilePath}`)
    }

    try {
      const content = readFileSync(this.configFilePath, "utf8")
      const parsed = loadYaml(content, {
        schema: FAILSAFE_SCHEMA,
        json: true
      }) as DumpBuildConfigFile

      BuildConfigFileLoader.validate(parsed)
      return parsed
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to load build config file ${this.configFilePath}: ${errorMessage}`)
    }
  }

  resolveBuild(buildName: string, cliBundler?: "webpack" | "rspack"): ResolvedDumpBuild {
    const config = this.load()
    return this.resolveBuildFromConfig(config, buildName, cliBundler)
  }

  private resolveBuildFromConfig(config: DumpBuildConfigFile, buildName: string, cliBundler?: "webpack" | "rspack"): ResolvedDumpBuild {
    const build = config.builds[buildName]

    if (!build) {
      const availableBuilds = Object.keys(config.builds).join(", ")
      throw new Error(
        `Build '${buildName}' not found in ${this.configFilePath}. Available builds: ${availableBuilds}`
      )
    }

    const bundler = cliBundler || build.bundler || config.default_bundler || "webpack"
    const environment = this.expandEnvironment(build.environment || {}, bundler)
    const resolvedConfigPath = this.expandString(build.config, bundler)

    return {
      name: buildName,
      description: build.description,
      bundler,
      environment,
      outputs: build.outputs || [],
      config: resolvedConfigPath
    }
  }

  resolveAllBuilds(cliBundler?: "webpack" | "rspack"): ResolvedDumpBuild[] {
    const config = this.load()

    return Object.keys(config.builds).map((buildName) => this.resolveBuildFromConfig(config, buildName, cliBundler))
  }

  listBuilds(cliBundler?: "webpack" | "rspack"): BuildSummary[] {
    const config = this.load()

    return Object.entries(config.builds).map(([name, build]) => {
      const bundler = cliBundler || build.bundler || config.default_bundler || "webpack"
      const resolvedConfigPath = this.expandString(build.config, bundler)

      return {
        name,
        description: build.description,
        bundler,
        config: resolvedConfigPath,
        outputs: build.outputs || []
      }
    })
  }

  private validateConfigPath(): void {
    if (this.configFilePath.includes("\u0000")) {
      throw new Error(`Invalid build config file path: ${this.configFilePath}`)
    }
  }

  private static validate(config: DumpBuildConfigFile): void {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error("Build config file must be a YAML object")
    }

    if (!config.builds || typeof config.builds !== "object" || Array.isArray(config.builds)) {
      throw new Error("Build config file must contain a 'builds' object")
    }

    if (Object.keys(config.builds).length === 0) {
      throw new Error("Build config file must contain at least one build")
    }

    if (
      config.default_bundler &&
      config.default_bundler !== "webpack" &&
      config.default_bundler !== "rspack"
    ) {
      throw new Error(
        `Invalid default_bundler '${config.default_bundler}'. Must be 'webpack' or 'rspack'.`
      )
    }

    for (const [name, build] of Object.entries(config.builds)) {
      if (!build || typeof build !== "object" || Array.isArray(build)) {
        throw new Error(`Invalid build '${name}': build must be an object`)
      }

      if (!build.config || typeof build.config !== "string") {
        throw new Error(`Invalid build '${name}': build.config is required and must be a string`)
      }

      if (build.bundler && build.bundler !== "webpack" && build.bundler !== "rspack") {
        throw new Error(`Invalid bundler '${build.bundler}' in build '${name}'`)
      }

      if (
        build.environment &&
        (typeof build.environment !== "object" || Array.isArray(build.environment))
      ) {
        throw new Error(`Invalid environment in build '${name}': must be an object`)
      }

      if (build.outputs && !Array.isArray(build.outputs)) {
        throw new Error(`Invalid outputs in build '${name}': must be an array of strings`)
      }

      if (build.outputs && build.outputs.some((output) => typeof output !== "string")) {
        throw new Error(`Invalid outputs in build '${name}': all output entries must be strings`)
      }
    }
  }

  private expandEnvironment(environment: Record<string, string>, bundler: string): Record<string, string> {
    const expanded: Record<string, string> = {}

    for (const [key, value] of Object.entries(environment)) {
      expanded[key] = this.expandString(value, bundler)
    }

    return expanded
  }

  private expandString(input: string, bundler: string): string {
    let expanded = input.replace(/\$\{BUNDLER\}/g, bundler)

    expanded = expanded.replace(/\$\{([^}:]+):-([^}]*)\}/g, (_match, variableName: string, defaultValue: string) => {
      if (!BuildConfigFileLoader.isValidEnvVarName(variableName)) {
        return `\${${variableName}:-${defaultValue}}`
      }

      return process.env[variableName] || defaultValue
    })

    expanded = expanded.replace(/\$\{([^}:]+)\}/g, (match, variableName: string) => {
      if (!BuildConfigFileLoader.isValidEnvVarName(variableName)) {
        return `\${${variableName}}`
      }

      const value = process.env[variableName]
      if (value === undefined) {
        throw new Error(
          `Environment variable '${variableName}' is not set (referenced in ${this.configFilePath}). ` +
          `Set it or use \${${variableName}:-default} syntax for a default value.`
        )
      }

      return value
    })

    return expanded
  }

  private static isValidEnvVarName(name: string): boolean {
    return /^[A-Z_][A-Z0-9_]*$/i.test(name)
  }
}

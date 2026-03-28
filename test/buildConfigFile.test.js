const fs = require("fs")
const os = require("os")
const path = require("path")

const { BuildConfigFileLoader } = require("../src/buildConfigFile")

describe("BuildConfigFileLoader", () => {
  let tempDir

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "build-config-"))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  function writeConfig(filename, content) {
    const filePath = path.join(tempDir, filename)
    fs.writeFileSync(filePath, content, "utf8")
    return filePath
  }

  function writeValidConfig(overrides = {}) {
    const defaults = {
      default_bundler: "webpack",
      builds: {
        dev: {
          config: "./webpack.config.js",
          outputs: ["client"]
        }
      }
    }

    const content = buildYaml({ ...defaults, ...overrides })
    return writeConfig("builds.yml", content)
  }

  function buildYaml(obj) {
    const lines = []

    if (obj.default_bundler) {
      lines.push(`default_bundler: ${obj.default_bundler}`)
    }

    if (obj.builds) {
      lines.push("builds:")
      for (const [name, build] of Object.entries(obj.builds)) {
        lines.push(`  ${name}:`)
        if (build.description) lines.push(`    description: ${build.description}`)
        if (build.bundler) lines.push(`    bundler: ${build.bundler}`)
        if (build.config) lines.push(`    config: "${build.config}"`)
        if (build.environment) {
          lines.push("    environment:")
          for (const [k, v] of Object.entries(build.environment)) {
            lines.push(`      ${k}: "${v}"`)
          }
        }
        if (build.outputs) {
          lines.push("    outputs:")
          for (const o of build.outputs) {
            lines.push(`      - ${o}`)
          }
        }
      }
    }

    return lines.join("\n") + "\n"
  }

  describe("exists", () => {
    test("returns true when file exists", () => {
      const filePath = writeValidConfig()
      const loader = new BuildConfigFileLoader(filePath)

      expect(loader.exists()).toBe(true)
    })

    test("returns false when file does not exist", () => {
      const loader = new BuildConfigFileLoader(
        path.join(tempDir, "nonexistent.yml")
      )

      expect(loader.exists()).toBe(false)
    })
  })

  describe("load", () => {
    test("loads a valid build config", () => {
      const filePath = writeValidConfig()
      const loader = new BuildConfigFileLoader(filePath)

      const config = loader.load()

      expect(config.default_bundler).toBe("webpack")
      expect(config.builds.dev).toBeDefined()
      expect(config.builds.dev.config).toBe("./webpack.config.js")
    })

    test("throws when file does not exist", () => {
      const loader = new BuildConfigFileLoader(
        path.join(tempDir, "missing.yml")
      )

      expect(() => loader.load()).toThrow("Build config file not found")
    })

    test("throws on invalid YAML", () => {
      const filePath = writeConfig("bad.yml", "builds:\n  dev:\n  config: [invalid")
      const loader = new BuildConfigFileLoader(filePath)

      expect(() => loader.load()).toThrow("Failed to load build config file")
    })
  })

  describe("validation", () => {
    test("rejects config without builds key", () => {
      const filePath = writeConfig("no-builds.yml", "default_bundler: webpack\n")
      const loader = new BuildConfigFileLoader(filePath)

      expect(() => loader.load()).toThrow("must contain a 'builds' object")
    })

    test("rejects empty builds", () => {
      const filePath = writeConfig("empty-builds.yml", "builds: {}\n")
      const loader = new BuildConfigFileLoader(filePath)

      expect(() => loader.load()).toThrow("must contain at least one build")
    })

    test("rejects invalid default_bundler", () => {
      const filePath = writeConfig(
        "bad-bundler.yml",
        "default_bundler: vite\nbuilds:\n  dev:\n    config: './config.js'\n"
      )
      const loader = new BuildConfigFileLoader(filePath)

      expect(() => loader.load()).toThrow("Invalid default_bundler 'vite'")
    })

    test("rejects build without config field", () => {
      const filePath = writeConfig(
        "no-config.yml",
        "builds:\n  dev:\n    bundler: webpack\n"
      )
      const loader = new BuildConfigFileLoader(filePath)

      expect(() => loader.load()).toThrow("build.config is required")
    })

    test("rejects invalid bundler on individual build", () => {
      const filePath = writeConfig(
        "bad-build-bundler.yml",
        'builds:\n  dev:\n    bundler: parcel\n    config: "./config.js"\n'
      )
      const loader = new BuildConfigFileLoader(filePath)

      expect(() => loader.load()).toThrow("Invalid bundler 'parcel'")
    })

    test("rejects null byte in file path", () => {
      expect(() => {
        new BuildConfigFileLoader("/tmp/builds\0.yml")
      }).toThrow("Invalid build config file path")
    })
  })

  describe("resolveBuild", () => {
    test("resolves a named build with defaults", () => {
      const filePath = writeValidConfig({
        builds: {
          dev: {
            config: "./webpack.config.js",
            environment: { NODE_ENV: "development" },
            outputs: ["client"]
          }
        }
      })
      const loader = new BuildConfigFileLoader(filePath)

      const resolved = loader.resolveBuild("dev")

      expect(resolved.name).toBe("dev")
      expect(resolved.bundler).toBe("webpack")
      expect(resolved.environment.NODE_ENV).toBe("development")
      expect(resolved.outputs).toEqual(["client"])
      expect(resolved.config).toBe("./webpack.config.js")
    })

    test("CLI bundler overrides build-level and default bundler", () => {
      const filePath = writeValidConfig({
        default_bundler: "webpack",
        builds: {
          dev: {
            bundler: "webpack",
            config: "./config.js",
            outputs: ["client"]
          }
        }
      })
      const loader = new BuildConfigFileLoader(filePath)

      const resolved = loader.resolveBuild("dev", "rspack")

      expect(resolved.bundler).toBe("rspack")
    })

    test("build-level bundler overrides default_bundler", () => {
      const filePath = writeValidConfig({
        default_bundler: "webpack",
        builds: {
          prod: {
            bundler: "rspack",
            config: "./rspack.config.js",
            outputs: ["client"]
          }
        }
      })
      const loader = new BuildConfigFileLoader(filePath)

      const resolved = loader.resolveBuild("prod")

      expect(resolved.bundler).toBe("rspack")
    })

    test("throws for unknown build name", () => {
      const filePath = writeValidConfig()
      const loader = new BuildConfigFileLoader(filePath)

      expect(() => loader.resolveBuild("nonexistent")).toThrow(
        "Build 'nonexistent' not found"
      )
    })

    test("defaults to empty outputs when not specified", () => {
      const filePath = writeConfig(
        "no-outputs.yml",
        'builds:\n  dev:\n    config: "./config.js"\n'
      )
      const loader = new BuildConfigFileLoader(filePath)

      const resolved = loader.resolveBuild("dev")
      expect(resolved.outputs).toEqual([])
    })
  })

  describe("resolveAllBuilds", () => {
    test("resolves all builds", () => {
      const filePath = writeValidConfig({
        builds: {
          dev: { config: "./dev.config.js", outputs: ["client"] },
          prod: {
            bundler: "rspack",
            config: "./prod.config.js",
            outputs: ["client", "server"]
          }
        }
      })
      const loader = new BuildConfigFileLoader(filePath)

      const builds = loader.resolveAllBuilds()

      expect(builds).toHaveLength(2)
      expect(builds[0].name).toBe("dev")
      expect(builds[1].name).toBe("prod")
      expect(builds[1].bundler).toBe("rspack")
    })
  })

  describe("listBuilds", () => {
    test("returns build summaries", () => {
      const filePath = writeValidConfig({
        builds: {
          dev: {
            description: "Development build",
            config: "./dev.config.js",
            outputs: ["client"]
          },
          prod: {
            bundler: "rspack",
            config: "./prod.config.js",
            outputs: ["client", "server"]
          }
        }
      })
      const loader = new BuildConfigFileLoader(filePath)

      const summaries = loader.listBuilds()

      expect(summaries).toHaveLength(2)
      expect(summaries[0]).toMatchObject({
        name: "dev",
        description: "Development build",
        bundler: "webpack",
        outputs: ["client"]
      })
      expect(summaries[1]).toMatchObject({
        name: "prod",
        bundler: "rspack",
        outputs: ["client", "server"]
      })
    })

    test("CLI bundler override applies to all summaries", () => {
      const filePath = writeValidConfig({
        builds: {
          dev: { config: "./config.js", outputs: ["client"] }
        }
      })
      const loader = new BuildConfigFileLoader(filePath)

      const summaries = loader.listBuilds("rspack")

      expect(summaries[0].bundler).toBe("rspack")
    })
  })

  describe("environment variable expansion", () => {
    test("expands ${BUNDLER} in config path", () => {
      const filePath = writeValidConfig({
        builds: {
          dev: {
            config: "./${BUNDLER}.config.js",
            outputs: ["client"]
          }
        }
      })
      const loader = new BuildConfigFileLoader(filePath)

      const resolved = loader.resolveBuild("dev")

      expect(resolved.config).toBe("./webpack.config.js")
    })

    test("expands ${VAR:-default} with fallback", () => {
      delete process.env.NONEXISTENT_VAR_FOR_TEST

      const filePath = writeValidConfig({
        builds: {
          dev: {
            config: "./config.js",
            environment: { MY_VAR: "${NONEXISTENT_VAR_FOR_TEST:-fallback}" },
            outputs: ["client"]
          }
        }
      })
      const loader = new BuildConfigFileLoader(filePath)

      const resolved = loader.resolveBuild("dev")

      expect(resolved.environment.MY_VAR).toBe("fallback")
    })

    test("expands ${VAR:-default} with actual env value when set", () => {
      const originalValue = process.env.EXPANSION_TEST_VAR
      process.env.EXPANSION_TEST_VAR = "real-value"

      try {
        const filePath = writeValidConfig({
          builds: {
            dev: {
              config: "./config.js",
              environment: { MY_VAR: "${EXPANSION_TEST_VAR:-fallback}" },
              outputs: ["client"]
            }
          }
        })
        const loader = new BuildConfigFileLoader(filePath)

        const resolved = loader.resolveBuild("dev")

        expect(resolved.environment.MY_VAR).toBe("real-value")
      } finally {
        if (originalValue === undefined) {
          delete process.env.EXPANSION_TEST_VAR
        } else {
          process.env.EXPANSION_TEST_VAR = originalValue
        }
      }
    })

    test("throws for ${VAR} when env var is not set", () => {
      delete process.env.REQUIRED_MISSING_VAR

      const filePath = writeValidConfig({
        builds: {
          dev: {
            config: "./config.js",
            environment: { MY_VAR: "${REQUIRED_MISSING_VAR}" },
            outputs: ["client"]
          }
        }
      })
      const loader = new BuildConfigFileLoader(filePath)

      expect(() => loader.resolveBuild("dev")).toThrow(
        "Environment variable 'REQUIRED_MISSING_VAR' is not set"
      )
    })

    test("ignores invalid env var names in expansion", () => {
      const filePath = writeValidConfig({
        builds: {
          dev: {
            config: "./config.js",
            environment: { MY_VAR: "${invalid-name:-default}" },
            outputs: ["client"]
          }
        }
      })
      const loader = new BuildConfigFileLoader(filePath)

      const resolved = loader.resolveBuild("dev")

      // Should leave the expression unexpanded
      expect(resolved.environment.MY_VAR).toBe("${invalid-name:-default}")
    })
  })
})

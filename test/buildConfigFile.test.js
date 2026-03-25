const fs = require("fs")
const os = require("os")
const path = require("path")

const { BuildConfigFileLoader } = require("../src/buildConfigFile")

describe("BuildConfigFileLoader", () => {
  let tempDir
  let previousOuter
  let hadOuter

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pack-config-diff-build-config-"))
    hadOuter = Object.prototype.hasOwnProperty.call(process.env, "OUTER_VALUE")
    previousOuter = process.env.OUTER_VALUE
    delete process.env.INNER_UNSET
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    delete process.env.INNER_UNSET
    if (hadOuter) {
      process.env.OUTER_VALUE = previousOuter
    } else {
      delete process.env.OUTER_VALUE
    }
  })

  test("does not recursively expand env var values from default syntax", () => {
    process.env.OUTER_VALUE = "${INNER_UNSET}"
    const buildConfigPath = path.join(tempDir, "pack-config-diff-builds.yml")
    fs.writeFileSync(
      buildConfigPath,
      [
        "builds:",
        "  dev:",
        '    config: "${OUTER_VALUE:-webpack.config.js}"'
      ].join("\n"),
      "utf8"
    )

    const loader = new BuildConfigFileLoader(buildConfigPath)
    const build = loader.resolveBuild("dev")

    expect(build.config).toBe("${INNER_UNSET}")
  })
})

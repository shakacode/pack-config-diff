const { YamlSerializer } = require("../src/yamlSerializer")

const metadata = {
  exportedAt: "2026-03-18T00:00:00.000Z",
  environment: "test",
  bundler: "webpack",
  configType: "single",
  configCount: 1
}

describe("YamlSerializer", () => {
  test.each(["true", "false", "null", "yes", "no", "on", "off", "123", "2024-01-01"])(
    "quotes YAML special scalar string %s",
    (value) => {
      const serializer = new YamlSerializer({ annotate: false, appRoot: "/app/project" })
      const output = serializer.serialize({ value }, metadata)

      expect(output).toContain(`value: "${value}"`)
    }
  )

  test("does not quote plain safe strings", () => {
    const serializer = new YamlSerializer({ annotate: false, appRoot: "/app/project" })
    const output = serializer.serialize({ value: "plain-text" }, metadata)

    expect(output).toContain("value: plain-text")
  })
})

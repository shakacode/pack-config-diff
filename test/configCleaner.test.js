const { cleanConfig } = require("../src/configCleaner")

describe("cleanConfig", () => {
  test("preserves RegExp values instead of replacing them with empty objects", () => {
    const config = {
      module: {
        rules: [{ test: /\.js$/i }]
      }
    }

    const cleaned = cleanConfig(config, "/app/project")

    expect(cleaned.module.rules[0].test).toBeInstanceOf(RegExp)
    expect(cleaned.module.rules[0].test.toString()).toBe("/\\.js$/i")
  })
})

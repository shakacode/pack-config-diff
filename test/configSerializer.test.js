const { serializeConfig } = require("../src/configSerializer");

const METADATA = {
  exportedAt: "2025-01-15T10:00:00.000Z",
  bundler: "webpack",
  environment: "production",
  configType: "client",
  configCount: 1,
};

describe("serializeConfig", () => {
  describe("YAML format", () => {
    test("dispatches to YamlSerializer", () => {
      const result = serializeConfig({ mode: "production" }, METADATA, { format: "yaml" });

      expect(result).toContain("# Webpack/Rspack Configuration Export");
      expect(result).toContain("mode: production");
    });

    test("passes annotate option through", () => {
      const result = serializeConfig({ mode: "production" }, METADATA, {
        format: "yaml",
        annotate: true,
      });

      expect(result).toContain("# Defines the environment mode");
    });

    test("passes appRoot option through", () => {
      const result = serializeConfig({ path: "/custom/root/src/index.js" }, METADATA, {
        format: "yaml",
        appRoot: "/custom/root",
      });

      expect(result).toContain("./src/index.js");
    });
  });

  describe("JSON format", () => {
    test("wraps config in metadata envelope", () => {
      const result = serializeConfig({ mode: "production" }, METADATA, { format: "json" });

      const parsed = JSON.parse(result);
      expect(parsed.metadata).toEqual(METADATA);
      expect(parsed.config.mode).toBe("production");
    });

    test("replaces BigInt with placeholder", () => {
      const result = serializeConfig({ size: BigInt(12345) }, METADATA, { format: "json" });

      const parsed = JSON.parse(result);
      expect(parsed.config.size).toBe("[BigInt: 12345]");
    });

    test("replaces named function with placeholder", () => {
      function myLoader() {
        return true;
      }
      const result = serializeConfig({ loader: myLoader }, METADATA, { format: "json" });

      const parsed = JSON.parse(result);
      expect(parsed.config.loader).toBe("[Function: myLoader]");
    });

    test("replaces anonymous function with placeholder including name", () => {
      // V8 infers function name from property assignment, so { loader: function() {} }
      // gives the function the name "loader". Use a pre-assigned variable to get no name.
      const anon = (() => function () {})();
      const result = serializeConfig({ loader: anon }, METADATA, { format: "json" });

      const parsed = JSON.parse(result);
      // Name may be empty or inferred; the key point is the [Function: ...] wrapper
      expect(parsed.config.loader).toMatch(/^\[Function: .*\]$/);
    });

    test("replaces RegExp with placeholder", () => {
      const result = serializeConfig({ pattern: /\.tsx?$/i }, METADATA, { format: "json" });

      const parsed = JSON.parse(result);
      expect(parsed.config.pattern).toBe("[RegExp: /\\.tsx?$/i]");
    });

    test("replaces class instances with constructor name", () => {
      class MiniCssExtractPlugin {}
      const result = serializeConfig({ plugin: new MiniCssExtractPlugin() }, METADATA, {
        format: "json",
      });

      const parsed = JSON.parse(result);
      expect(parsed.config.plugin).toBe("[MiniCssExtractPlugin]");
    });

    test("preserves plain objects and arrays", () => {
      const config = {
        entry: { main: "./src/index.js" },
        extensions: [".js", ".ts"],
      };
      const result = serializeConfig(config, METADATA, { format: "json" });

      const parsed = JSON.parse(result);
      expect(parsed.config.entry).toEqual({ main: "./src/index.js" });
      expect(parsed.config.extensions).toEqual([".js", ".ts"]);
    });
  });

  describe("inspect format", () => {
    test("includes metadata and config sections", () => {
      const result = serializeConfig({ mode: "production" }, METADATA, { format: "inspect" });

      expect(result).toContain("=== METADATA ===");
      expect(result).toContain("=== CONFIG ===");
      expect(result).toContain("mode: 'production'");
    });

    test("handles array configs with indexing", () => {
      const result = serializeConfig(
        [{ name: "client" }, { name: "server" }],
        { ...METADATA, configCount: 2 },
        { format: "inspect" },
      );

      expect(result).toContain("Total configs: 2");
      expect(result).toContain("--- Config [0] ---");
      expect(result).toContain("--- Config [1] ---");
    });

    test("respects depth option", () => {
      const deepConfig = { a: { b: { c: { d: "deep" } } } };

      const shallow = serializeConfig(deepConfig, METADATA, {
        format: "inspect",
        depth: 1,
      });
      const deep = serializeConfig(deepConfig, METADATA, {
        format: "inspect",
        depth: 10,
      });

      // Shallow should truncate nested objects
      expect(shallow).toContain("[Object]");
      // Deep should show the full path
      expect(deep).toContain("deep");
    });
  });
});

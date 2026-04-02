const { cleanConfig } = require("../src/configCleaner");

const ROOT_PATH = "/app/project";

describe("cleanConfig", () => {
  test("passes through primitive values", () => {
    expect(cleanConfig("hello", ROOT_PATH)).toBe("hello");
    expect(cleanConfig(42, ROOT_PATH)).toBe(42);
    expect(cleanConfig(true, ROOT_PATH)).toBe(true);
    expect(cleanConfig(null, ROOT_PATH)).toBe(null);
  });

  test("relativizes absolute string paths under rootPath", () => {
    const result = cleanConfig({ output: { path: "/app/project/public/packs" } }, ROOT_PATH);

    expect(result.output.path).toBe("./public/packs");
  });

  test("keeps absolute paths outside rootPath unchanged", () => {
    const result = cleanConfig({ binary: "/usr/local/bin/node" }, ROOT_PATH);

    expect(result.binary).toBe("/usr/local/bin/node");
  });

  test("leaves relative paths unchanged", () => {
    const result = cleanConfig({ entry: "./src/index.js" }, ROOT_PATH);

    expect(result.entry).toBe("./src/index.js");
  });

  test("minifies functions to single line", () => {
    function multiLineFunction() {
      const x = 1;
      const y = 2;
      return x + y;
    }

    const result = cleanConfig({ fn: multiLineFunction }, ROOT_PATH);

    expect(typeof result.fn).toBe("string");
    expect(result.fn).not.toContain("\n");
    expect(result.fn).toContain("return x + y");
  });

  test("preserves RegExp values", () => {
    const regex = /\.jsx?$/i;
    const result = cleanConfig({ test: regex }, ROOT_PATH);

    expect(result.test).toBe(regex);
    expect(result.test).toBeInstanceOf(RegExp);
  });

  test("filters EnvironmentPlugin.keys", () => {
    function EnvironmentPlugin() {}
    const plugin = new EnvironmentPlugin();
    plugin.keys = ["SECRET_KEY", "API_TOKEN"];
    plugin.defaultValues = { SECRET_KEY: "xxx" };

    const result = cleanConfig(plugin, ROOT_PATH);

    expect(result.keys).toBe("[FILTERED]");
    expect(result.defaultValues).toBe("[FILTERED]");
  });

  test("filters DefinePlugin.definitions", () => {
    function DefinePlugin() {}
    const plugin = new DefinePlugin();
    plugin.definitions = { "process.env.SECRET": JSON.stringify("hidden") };

    const result = cleanConfig(plugin, ROOT_PATH);

    expect(result.definitions).toBe("[FILTERED]");
  });

  test("recursively cleans nested objects", () => {
    const config = {
      output: {
        path: "/app/project/dist",
        nested: {
          src: "/app/project/src/utils",
        },
      },
    };

    const result = cleanConfig(config, ROOT_PATH);

    expect(result.output.path).toBe("./dist");
    expect(result.output.nested.src).toBe("./src/utils");
  });

  test("recursively cleans arrays", () => {
    const config = {
      paths: ["/app/project/src", "/app/project/lib", "/usr/share/data"],
    };

    const result = cleanConfig(config, ROOT_PATH);

    expect(result.paths).toEqual(["./src", "./lib", "/usr/share/data"]);
  });

  test("strips undefined values from cleaned objects", () => {
    const config = { a: 1, b: undefined, c: 3 };
    const result = cleanConfig(config, ROOT_PATH);

    expect(result).toEqual({ a: 1, c: 3 });
    expect("b" in result).toBe(false);
  });
});

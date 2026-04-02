const fs = require("fs");
const os = require("os");
const path = require("path");

const { loadConfigFile, resolveExportedConfig, loadJsLikeConfig } = require("../src/configLoader");

describe("configLoader", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-loader-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("resolveExportedConfig", () => {
    test("returns non-function exports directly", () => {
      const config = { mode: "production" };
      expect(resolveExportedConfig(config)).toBe(config);
    });

    test("calls function exports with env and argv", () => {
      const factory = jest.fn((env, argv) => ({
        mode: argv.mode,
      }));

      const result = resolveExportedConfig(factory);

      expect(factory).toHaveBeenCalledWith({}, { mode: "production" });
      expect(result).toEqual({ mode: "production" });
    });

    test("passes custom mode to function exports", () => {
      const factory = jest.fn((env, argv) => ({
        mode: argv.mode,
      }));

      resolveExportedConfig(factory, "development");

      expect(factory).toHaveBeenCalledWith({}, { mode: "development" });
    });
  });

  describe("loadConfigFile", () => {
    test("loads JSON files", () => {
      const configPath = path.join(tempDir, "config.json");
      fs.writeFileSync(configPath, JSON.stringify({ mode: "production" }));

      const result = loadConfigFile(configPath);
      expect(result).toEqual({ mode: "production" });
    });

    test("loads YAML files with .yaml extension", () => {
      const configPath = path.join(tempDir, "config.yaml");
      fs.writeFileSync(configPath, "mode: production\ndevtool: false\n");

      const result = loadConfigFile(configPath);
      expect(result).toEqual({ mode: "production", devtool: false });
    });

    test("loads YAML files with .yml extension", () => {
      const configPath = path.join(tempDir, "config.yml");
      fs.writeFileSync(configPath, "mode: development\n");

      const result = loadConfigFile(configPath);
      expect(result).toEqual({ mode: "development" });
    });

    test("loads JS module.exports", () => {
      const configPath = path.join(tempDir, "webpack.config.js");
      fs.writeFileSync(configPath, "module.exports = { mode: 'production' }\n");

      const result = loadConfigFile(configPath);
      expect(result).toEqual({ mode: "production" });
    });

    test("loads JS function exports and calls them", () => {
      const configPath = path.join(tempDir, "webpack.config.js");
      fs.writeFileSync(configPath, "module.exports = (env, argv) => ({ mode: argv.mode })\n");

      const result = loadConfigFile(configPath);
      expect(result).toEqual({ mode: "production" });
    });

    test("loads JS default exports", () => {
      const configPath = path.join(tempDir, "webpack.config.js");
      fs.writeFileSync(configPath, "module.exports = { default: { mode: 'production' } }\n");

      const result = loadConfigFile(configPath);
      expect(result).toEqual({ mode: "production" });
    });

    test("throws on file not found", () => {
      expect(() => {
        loadConfigFile(path.join(tempDir, "nonexistent.js"));
      }).toThrow("Config file not found");
    });

    test("throws on unsupported extension", () => {
      const configPath = path.join(tempDir, "config.toml");
      fs.writeFileSync(configPath, "[mode]\nvalue = 'production'\n");

      expect(() => {
        loadConfigFile(configPath);
      }).toThrow("Unsupported file extension: .toml");
    });

    test("throws helpful error for .ts without ts-node", () => {
      const configPath = path.join(tempDir, "config.ts");
      fs.writeFileSync(configPath, "export default { mode: 'production' }\n");

      expect(() => {
        loadConfigFile(configPath);
      }).toThrow("ts-node is required");
    });
  });

  describe("loadJsLikeConfig", () => {
    test("loads different JS configs independently", () => {
      const configA = path.join(tempDir, "configA.js");
      const configB = path.join(tempDir, "configB.js");

      fs.writeFileSync(configA, "module.exports = { version: 1 }\n");
      fs.writeFileSync(configB, "module.exports = { version: 2 }\n");

      expect(loadJsLikeConfig(configA)).toEqual({ version: 1 });
      expect(loadJsLikeConfig(configB)).toEqual({ version: 2 });
    });

    test("handles array config exports", () => {
      const configPath = path.join(tempDir, "webpack.config.js");
      fs.writeFileSync(configPath, "module.exports = [{ name: 'client' }, { name: 'server' }]\n");

      const result = loadJsLikeConfig(configPath);
      expect(result).toEqual([{ name: "client" }, { name: "server" }]);
    });
  });
});

const fs = require("fs");
const os = require("os");
const path = require("path");

const { FileWriter } = require("../src/fileWriter");

describe("FileWriter", () => {
  let tempDir;
  let logSpy;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-writer-"));
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("generateFilename", () => {
    test("YAML format uses .yml extension", () => {
      const name = FileWriter.generateFilename("webpack", "production", "client", "yaml");

      expect(name).toBe("webpack-production-client.yml");
    });

    test("JSON format uses .json extension", () => {
      const name = FileWriter.generateFilename("rspack", "development", "server", "json");

      expect(name).toBe("rspack-development-server.json");
    });

    test("inspect format uses .txt extension", () => {
      const name = FileWriter.generateFilename("webpack", "production", "client", "inspect");

      expect(name).toBe("webpack-production-client.txt");
    });

    test("buildName overrides env in filename", () => {
      const name = FileWriter.generateFilename(
        "webpack",
        "production",
        "client",
        "yaml",
        "my-build",
      );

      expect(name).toBe("webpack-my-build-client.yml");
    });
  });

  describe("validateOutputPath", () => {
    test("accepts paths within cwd", () => {
      const filePath = path.join(process.cwd(), "output", "dump.yml");

      expect(() => FileWriter.validateOutputPath(filePath)).not.toThrow();
    });

    test("accepts paths within tmpdir", () => {
      const filePath = path.join(os.tmpdir(), "dump.yml");

      expect(() => FileWriter.validateOutputPath(filePath)).not.toThrow();
    });

    test("rejects paths outside cwd and tmpdir", () => {
      expect(() => {
        FileWriter.validateOutputPath("/etc/passwd");
      }).toThrow("Refusing to write");
    });
  });

  describe("writeSingleFile", () => {
    test("writes content to file", () => {
      const filePath = path.join(tempDir, "output.yml");

      FileWriter.writeSingleFile(filePath, "mode: production\n");

      expect(fs.readFileSync(filePath, "utf8")).toBe("mode: production\n");
    });

    test("creates parent directories if needed", () => {
      const filePath = path.join(tempDir, "nested", "dir", "output.yml");

      FileWriter.writeSingleFile(filePath, "content\n");

      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe("writeMultipleFiles", () => {
    test("writes all output files to directory", () => {
      const outputDir = path.join(tempDir, "exports");
      const outputs = [
        {
          filename: "webpack-prod-client.yml",
          content: "mode: production\n",
          metadata: {
            exportedAt: "2025-01-01",
            bundler: "webpack",
            environment: "production",
            configType: "client",
            configCount: 1,
          },
        },
        {
          filename: "webpack-prod-server.yml",
          content: "mode: production\ntarget: node\n",
          metadata: {
            exportedAt: "2025-01-01",
            bundler: "webpack",
            environment: "production",
            configType: "server",
            configCount: 1,
          },
        },
      ];

      FileWriter.writeMultipleFiles(outputs, outputDir);

      expect(fs.readFileSync(path.join(outputDir, "webpack-prod-client.yml"), "utf8")).toBe(
        "mode: production\n",
      );
      expect(fs.readFileSync(path.join(outputDir, "webpack-prod-server.yml"), "utf8")).toBe(
        "mode: production\ntarget: node\n",
      );
    });

    test("logs created file paths", () => {
      const outputDir = path.join(tempDir, "exports");
      const outputs = [
        {
          filename: "dump.yml",
          content: "content\n",
          metadata: {
            exportedAt: "2025-01-01",
            bundler: "webpack",
            environment: "production",
            configType: "client",
            configCount: 1,
          },
        },
      ];

      FileWriter.writeMultipleFiles(outputs, outputDir);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[pack-config-diff] Created:"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Exported 1 config file(s)"));
    });

    test("strips path traversal from filenames", () => {
      const outputDir = path.join(tempDir, "exports");
      const outputs = [
        {
          filename: "../../etc/evil.yml",
          content: "safe\n",
          metadata: {
            exportedAt: "2025-01-01",
            bundler: "webpack",
            environment: "production",
            configType: "client",
            configCount: 1,
          },
        },
      ];

      FileWriter.writeMultipleFiles(outputs, outputDir);

      // basename() should strip the traversal, writing to outputDir/evil.yml
      expect(fs.existsSync(path.join(outputDir, "evil.yml"))).toBe(true);
      expect(fs.existsSync("/etc/evil.yml")).toBe(false);
    });
  });
});

const fs = require("fs");
const os = require("os");
const path = require("path");

const { run } = require("../src/cli");

describe("CLI integration", () => {
  let tempDir;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pack-config-diff-"));
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("prints help and exits 0", () => {
    const code = run(["--help"]);

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("pack-config-diff — Semantic config differ"),
    );
  });

  test("returns 1 when differences are found", () => {
    const left = path.join(tempDir, "left.json");
    const right = path.join(tempDir, "right.json");

    fs.writeFileSync(left, JSON.stringify({ mode: "development" }), "utf8");
    fs.writeFileSync(right, JSON.stringify({ mode: "production" }), "utf8");

    const code = run([`--left=${left}`, `--right=${right}`, "--format=summary"]);

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith("1 changes: +0 -0 ~1");
  });

  test("supports markdown output format", () => {
    const left = path.join(tempDir, "left.json");
    const right = path.join(tempDir, "right.json");

    fs.writeFileSync(left, JSON.stringify({ mode: "development" }), "utf8");
    fs.writeFileSync(right, JSON.stringify({ mode: "production" }), "utf8");

    const code = run([`--left=${left}`, `--right=${right}`, "--format=markdown"]);

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("## pack-config-diff report"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("| # | Op | Path |"));
  });

  test("returns 0 when no differences are found", () => {
    const left = path.join(tempDir, "left.yaml");
    const right = path.join(tempDir, "right.yaml");

    fs.writeFileSync(left, "mode: production\n", "utf8");
    fs.writeFileSync(right, "mode: production\n", "utf8");

    const code = run([`--left=${left}`, `--right=${right}`, "--format=summary"]);

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith("✅ No differences found");
  });

  test("writes output to file when --output is provided", () => {
    const left = path.join(tempDir, "left.json");
    const right = path.join(tempDir, "right.json");
    const output = path.join(tempDir, "report.txt");

    fs.writeFileSync(left, JSON.stringify({ mode: "development" }), "utf8");
    fs.writeFileSync(right, JSON.stringify({ mode: "production" }), "utf8");

    const code = run([
      `--left=${left}`,
      `--right=${right}`,
      `--output=${output}`,
      "--format=summary",
    ]);

    expect(code).toBe(1);
    expect(fs.readFileSync(output, "utf8")).toContain("1 changes: +0 -0 ~1");
    expect(logSpy).not.toHaveBeenCalled();
  });

  test("path normalization can make machine-specific absolute paths comparable", () => {
    const left = path.join(tempDir, "left.json");
    const right = path.join(tempDir, "right.json");

    fs.writeFileSync(
      left,
      JSON.stringify({ output: { path: "/Users/alice/project/public/packs" } }),
      "utf8",
    );
    fs.writeFileSync(
      right,
      JSON.stringify({ output: { path: "/home/bob/project/public/packs" } }),
      "utf8",
    );

    const withNormalization = run([`--left=${left}`, `--right=${right}`, "--format=summary"]);
    const withoutNormalization = run([
      `--left=${left}`,
      `--right=${right}`,
      "--format=summary",
      "--no-normalize-paths",
    ]);

    expect(withNormalization).toBe(0);
    expect(withoutNormalization).toBe(1);
    expect(logSpy).toHaveBeenNthCalledWith(1, "✅ No differences found");
    expect(logSpy).toHaveBeenNthCalledWith(2, "1 changes: +0 -0 ~1");
  });

  test("plugin-aware compares shared class instances by options", () => {
    const sharedPlugin = path.join(tempDir, "shared-plugin.js");
    const left = path.join(tempDir, "left.js");
    const right = path.join(tempDir, "right.js");

    fs.writeFileSync(
      sharedPlugin,
      [
        "class SharedPlugin {",
        "  constructor(level) {",
        "    this.level = level",
        "  }",
        "}",
        "module.exports = { SharedPlugin }",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      left,
      [
        "const { SharedPlugin } = require('./shared-plugin')",
        "module.exports = { plugins: [new SharedPlugin(2)] }",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      right,
      [
        "const { SharedPlugin } = require('./shared-plugin')",
        "module.exports = { plugins: [new SharedPlugin(2)] }",
      ].join("\n"),
      "utf8",
    );

    const withoutPluginAware = run([`--left=${left}`, `--right=${right}`, "--format=summary"]);
    const withPluginAware = run([
      `--left=${left}`,
      `--right=${right}`,
      "--format=summary",
      "--plugin-aware",
    ]);

    expect(withoutPluginAware).toBe(1);
    expect(withPluginAware).toBe(0);
    expect(logSpy).toHaveBeenNthCalledWith(1, "1 changes: +0 -0 ~1");
    expect(logSpy).toHaveBeenNthCalledWith(2, "✅ No differences found");
  });

  test("match-rules-by-test reduces noisy module.rules reorder diffs", () => {
    const left = path.join(tempDir, "left.json");
    const right = path.join(tempDir, "right.json");

    fs.writeFileSync(
      left,
      JSON.stringify({
        module: {
          rules: [
            { test: "\\\\.js$", use: "babel-loader" },
            { test: "\\\\.css$", use: ["style-loader", "css-loader"] },
          ],
        },
      }),
      "utf8",
    );
    fs.writeFileSync(
      right,
      JSON.stringify({
        module: {
          rules: [
            { test: "\\\\.css$", use: ["style-loader", "css-loader"] },
            { test: "\\\\.js$", use: "babel-loader" },
          ],
        },
      }),
      "utf8",
    );

    const defaultCode = run([`--left=${left}`, `--right=${right}`, "--format=summary"]);
    const matchedCode = run([
      `--left=${left}`,
      `--right=${right}`,
      "--format=summary",
      "--match-rules-by-test",
    ]);

    expect(defaultCode).toBe(1);
    expect(matchedCode).toBe(0);
    expect(logSpy).toHaveBeenNthCalledWith(1, "4 changes: +0 -0 ~4");
    expect(logSpy).toHaveBeenNthCalledWith(2, "✅ No differences found");
  });

  test("returns exit code 2 when --left and --right are missing", () => {
    const code = run([]);

    expect(code).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("--left and --right are required"),
    );
  });

  test("returns exit code 2 when config file does not exist", () => {
    const code = run(["--left=/nonexistent/left.json", "--right=/nonexistent/right.json"]);

    expect(code).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Config file not found"));
  });

  test("returns a helpful message when loading .ts configs without ts-node", () => {
    const left = path.join(tempDir, "left.ts");
    const right = path.join(tempDir, "right.json");

    fs.writeFileSync(left, "export default { mode: 'production' }\n", "utf8");
    fs.writeFileSync(right, JSON.stringify({ mode: "production" }), "utf8");

    const code = run([`--left=${left}`, `--right=${right}`, "--format=summary"]);

    expect(code).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ts-node is required"));
  });
});

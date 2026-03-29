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
      expect.stringContaining("pack-config-diff — Semantic config tooling"),
    );
  });

  test("supports explicit diff subcommand", () => {
    const left = path.join(tempDir, "left.json");
    const right = path.join(tempDir, "right.json");

    fs.writeFileSync(left, JSON.stringify({ mode: "development" }), "utf8");
    fs.writeFileSync(right, JSON.stringify({ mode: "production" }), "utf8");

    const code = run(["diff", `--left=${left}`, `--right=${right}`, "--format=summary"]);

    expect(code).toBe(1);
    expect(logSpy).toHaveBeenCalledWith("1 changes: +0 -0 ~1");
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

  test("returns a helpful message when loading .ts configs without ts-node", () => {
    const left = path.join(tempDir, "left.ts");
    const right = path.join(tempDir, "right.json");

    fs.writeFileSync(left, "export default { mode: 'production' }\n", "utf8");
    fs.writeFileSync(right, JSON.stringify({ mode: "production" }), "utf8");

    const code = run([`--left=${left}`, `--right=${right}`, "--format=summary"]);

    expect(code).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ts-node is required"));
  });

  test("dump command outputs YAML by default", () => {
    const configPath = path.join(tempDir, "webpack.config.js");
    fs.writeFileSync(
      configPath,
      [
        "module.exports = {",
        "  mode: 'production',",
        "  output: { path: '/app/project/public/packs' }",
        "}",
      ].join("\n"),
      "utf8",
    );

    const code = run(["dump", configPath]);

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("# Webpack/Rspack Configuration Export"),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("mode: production"));
  });

  test("dump command supports JSON format with special type placeholders", () => {
    const configPath = path.join(tempDir, "webpack.config.js");
    fs.writeFileSync(
      configPath,
      [
        "class DemoPlugin {}",
        "module.exports = {",
        "  pattern: /demo/gi,",
        "  transform: function applyTransform() { return true },",
        "  plugin: new DemoPlugin()",
        "}",
      ].join("\n"),
      "utf8",
    );

    const code = run(["dump", configPath, "--format=json"]);

    expect(code).toBe(0);
    const payload = JSON.parse(logSpy.mock.calls[0][0]);
    expect(payload.config.pattern).toBe("[RegExp: /demo/gi]");
    expect(payload.config.transform).toBe("[Function: applyTransform]");
    expect(payload.config.plugin).toBe("[DemoPlugin]");
  });

  test("dump command writes output file when --output is provided", () => {
    const configPath = path.join(tempDir, "webpack.config.js");
    const outputPath = path.join(tempDir, "dump.yml");
    fs.writeFileSync(configPath, "module.exports = { mode: 'production' }\n", "utf8");

    const code = run(["dump", configPath, `--output=${outputPath}`]);

    expect(code).toBe(0);
    expect(fs.readFileSync(outputPath, "utf8")).toContain("mode: production");
    expect(logSpy).not.toHaveBeenCalled();
  });

  test("dump --env applies variables during config load and restores afterward", () => {
    const configPath = path.join(tempDir, "webpack.config.js");
    const originalNodeEnv = process.env.NODE_ENV;

    fs.writeFileSync(
      configPath,
      [
        "module.exports = () => ({",
        "  mode: process.env.NODE_ENV,",
        `  projectPath: '${tempDir}/src'`,
        "})",
      ].join("\n"),
      "utf8",
    );

    const code = run([
      "dump",
      configPath,
      "--clean",
      "--format=json",
      `--app-root=${tempDir}`,
      "--env=NODE_ENV=production",
    ]);

    expect(code).toBe(0);
    const payload = JSON.parse(logSpy.mock.calls[0][0]);
    expect(payload.config.mode).toBe("production");
    expect(payload.config.projectPath).toBe("./src");
    expect(process.env.NODE_ENV).toBe(originalNodeEnv);
  });

  test("dump --annotate injects inline docs for known keys", () => {
    const configPath = path.join(tempDir, "webpack.config.js");
    fs.writeFileSync(configPath, "module.exports = { mode: 'production' }\n", "utf8");

    const code = run(["dump", configPath, "--annotate"]);

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Defines the environment mode"));
  });

  test("dump --annotate fails for non-YAML formats", () => {
    const configPath = path.join(tempDir, "webpack.config.js");
    fs.writeFileSync(configPath, "module.exports = { mode: 'production' }\n", "utf8");

    const code = run(["dump", configPath, "--format=json", "--annotate"]);

    expect(code).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("--annotate requires --format=yaml"),
    );
  });

  test("dump --list-builds reads build config entries", () => {
    const webpackConfig = path.join(tempDir, "webpack.config.js");
    const rspackConfig = path.join(tempDir, "rspack.config.js");
    const buildConfig = path.join(tempDir, "pack-config-diff-builds.yml");

    fs.writeFileSync(webpackConfig, "module.exports = { mode: 'development' }\n", "utf8");
    fs.writeFileSync(rspackConfig, "module.exports = { mode: 'production' }\n", "utf8");
    fs.writeFileSync(
      buildConfig,
      [
        "default_bundler: webpack",
        "builds:",
        "  dev:",
        "    description: Development build",
        `    config: "${webpackConfig}"`,
        "    outputs:",
        "      - client",
        "  prod:",
        "    bundler: rspack",
        `    config: "${rspackConfig}"`,
        "    outputs:",
        "      - client",
      ].join("\n"),
      "utf8",
    );

    const code = run(["dump", "--list-builds", `--config-file=${buildConfig}`]);

    expect(code).toBe(0);
    const output = logSpy.mock.calls.map((args) => args[0]).join("\n");
    expect(output).toContain("Available builds");
    expect(output).toContain("- dev");
    expect(output).toContain("- prod");
    expect(output).toContain("bundler: webpack");
    expect(output).toContain("bundler: rspack");
  });

  test("dump --build writes split outputs using configured output names", () => {
    const configPath = path.join(tempDir, "webpack.array.config.js");
    const buildConfig = path.join(tempDir, "pack-config-diff-builds.yml");
    const outputDir = path.join(tempDir, "exports");

    fs.writeFileSync(
      configPath,
      [
        "module.exports = () => [",
        "  { name: 'client', mode: process.env.NODE_ENV },",
        "  { name: 'server', mode: process.env.NODE_ENV }",
        "]",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      buildConfig,
      [
        "builds:",
        "  prod:",
        "    bundler: rspack",
        "    environment:",
        "      NODE_ENV: production",
        `    config: "${configPath}"`,
        "    outputs:",
        "      - client",
        "      - server",
      ].join("\n"),
      "utf8",
    );

    const code = run([
      "dump",
      "--build=prod",
      `--config-file=${buildConfig}`,
      `--save-dir=${outputDir}`,
    ]);

    expect(code).toBe(0);
    const clientDump = path.join(outputDir, "rspack-prod-client.yml");
    const serverDump = path.join(outputDir, "rspack-prod-server.yml");
    expect(fs.existsSync(clientDump)).toBe(true);
    expect(fs.existsSync(serverDump)).toBe(true);
    expect(fs.readFileSync(clientDump, "utf8")).toContain("mode: production");
    expect(fs.readFileSync(serverDump, "utf8")).toContain("mode: production");
  });

  test("dump --all-builds exports webpack and rspack builds in one run", () => {
    const webpackConfig = path.join(tempDir, "webpack.config.js");
    const rspackConfig = path.join(tempDir, "rspack.config.js");
    const buildConfig = path.join(tempDir, "pack-config-diff-builds.yml");
    const outputDir = path.join(tempDir, "all-builds");

    fs.writeFileSync(webpackConfig, "module.exports = { mode: 'development' }\n", "utf8");
    fs.writeFileSync(rspackConfig, "module.exports = { mode: 'production' }\n", "utf8");
    fs.writeFileSync(
      buildConfig,
      [
        "builds:",
        "  dev:",
        "    bundler: webpack",
        "    environment:",
        "      NODE_ENV: development",
        `    config: "${webpackConfig}"`,
        "    outputs:",
        "      - client",
        "  prod:",
        "    bundler: rspack",
        "    environment:",
        "      NODE_ENV: production",
        `    config: "${rspackConfig}"`,
        "    outputs:",
        "      - client",
      ].join("\n"),
      "utf8",
    );

    const code = run([
      "dump",
      "--all-builds",
      `--config-file=${buildConfig}`,
      `--save-dir=${outputDir}`,
    ]);

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(outputDir, "webpack-dev-client.yml"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "rspack-prod-client.yml"))).toBe(true);
  });
});

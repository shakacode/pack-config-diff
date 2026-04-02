const { YamlSerializer } = require("../src/yamlSerializer");

const METADATA = {
  exportedAt: "2025-01-15T10:00:00.000Z",
  bundler: "webpack",
  environment: "production",
  configType: "client",
  configCount: 1,
};

function makeSerializer(options = {}) {
  return new YamlSerializer({
    annotate: options.annotate || false,
    appRoot: options.appRoot || "/app/project",
  });
}

describe("YamlSerializer", () => {
  describe("header", () => {
    test("includes metadata fields", () => {
      const s = makeSerializer();
      const output = s.serialize({}, METADATA);

      expect(output).toContain("# Webpack/Rspack Configuration Export");
      expect(output).toContain("# Generated: 2025-01-15T10:00:00.000Z");
      expect(output).toContain("# Environment: production");
      expect(output).toContain("# Bundler: webpack");
      expect(output).toContain("# Config Type: client");
    });

    test("includes Total Configs only when configCount > 1", () => {
      const s = makeSerializer();

      const single = s.serialize({}, { ...METADATA, configCount: 1 });
      expect(single).not.toContain("Total Configs");

      const multi = s.serialize({}, { ...METADATA, configCount: 3 });
      expect(multi).toContain("# Total Configs: 3");
    });
  });

  describe("primitive values", () => {
    test("serializes null and undefined as null", () => {
      const s = makeSerializer();
      const output = s.serialize({ a: null, b: undefined }, METADATA);

      expect(output).toContain("a: null");
      expect(output).toContain("b: null");
    });

    test("serializes booleans", () => {
      const s = makeSerializer();
      const output = s.serialize({ a: true, b: false }, METADATA);

      expect(output).toContain("a: true");
      expect(output).toContain("b: false");
    });

    test("serializes numbers", () => {
      const s = makeSerializer();
      const output = s.serialize({ port: 8080, ratio: 0.5 }, METADATA);

      expect(output).toContain("port: 8080");
      expect(output).toContain("ratio: 0.5");
    });
  });

  describe("string serialization", () => {
    test("plain strings pass through unquoted", () => {
      const s = makeSerializer();
      const output = s.serialize({ mode: "production" }, METADATA);

      expect(output).toContain("mode: production");
    });

    test("YAML-ambiguous scalars are quoted", () => {
      const s = makeSerializer();
      const output = s.serialize(
        {
          a: "true",
          b: "false",
          c: "null",
          d: "yes",
          e: "no",
          f: "on",
          g: "off",
        },
        METADATA,
      );

      expect(output).toContain('a: "true"');
      expect(output).toContain('b: "false"');
      expect(output).toContain('c: "null"');
      expect(output).toContain('d: "yes"');
      expect(output).toContain('e: "no"');
      expect(output).toContain('f: "on"');
      expect(output).toContain('g: "off"');
    });

    test("numeric-looking strings are quoted", () => {
      const s = makeSerializer();
      const output = s.serialize({ version: "3.14", hex: "0xFF" }, METADATA);

      expect(output).toContain('version: "3.14"');
      expect(output).toContain('hex: "0xFF"');
    });

    test("strings with special characters are quoted", () => {
      const s = makeSerializer();
      const output = s.serialize(
        {
          colon: "key: value",
          hash: "color #red",
          bracket: "[item]",
          brace: "{thing}",
          star: "glob*",
          amp: "a & b",
          bang: "!important",
          backtick: "code `here`",
          empty: "",
        },
        METADATA,
      );

      expect(output).toContain('"key: value"');
      expect(output).toContain('"color #red"');
      expect(output).toContain('"[item]"');
      expect(output).toContain('"{thing}"');
      expect(output).toContain('"glob*"');
      expect(output).toContain('"a & b"');
      expect(output).toContain('"!important"');
      expect(output).toContain('"code `here`"');
      expect(output).toContain('empty: ""');
    });

    test("strings starting/ending with spaces are quoted", () => {
      const s = makeSerializer();
      const output = s.serialize({ leading: " hello", trailing: "world " }, METADATA);

      expect(output).toContain('" hello"');
      expect(output).toContain('"world "');
    });

    test("multiline strings use block literal style", () => {
      const s = makeSerializer();
      const output = s.serialize({ code: "line1\nline2\nline3" }, METADATA);

      expect(output).toContain("code: |");
      expect(output).toContain("  line1");
      expect(output).toContain("  line2");
      expect(output).toContain("  line3");
    });

    test("CRLF multiline strings are double-quoted with escaped control characters", () => {
      const s = makeSerializer();
      const output = s.serialize({ code: "line1\r\nline2" }, METADATA);

      expect(output).toContain('code: "line1\\r\\nline2"');
      expect(output).not.toContain("code: |");
    });

    test("strings with double quotes are escaped", () => {
      const s = makeSerializer();
      const output = s.serialize({ val: 'say "hello"' }, METADATA);

      expect(output).toContain('"say \\"hello\\""');
    });
  });

  describe("path relativization", () => {
    test("absolute paths under appRoot become relative", () => {
      const s = makeSerializer({ appRoot: "/app/project" });
      const output = s.serialize({ path: "/app/project/public/packs" }, METADATA);

      expect(output).toContain("path: ./public/packs");
    });

    test("absolute paths outside appRoot are kept absolute", () => {
      const s = makeSerializer({ appRoot: "/app/project" });
      const output = s.serialize({ path: "/usr/local/bin/node" }, METADATA);

      expect(output).toContain("path: /usr/local/bin/node");
    });

    test("relative paths are left unchanged", () => {
      const s = makeSerializer({ appRoot: "/app/project" });
      const output = s.serialize({ path: "./src/index.js" }, METADATA);

      expect(output).toContain("path: ./src/index.js");
    });

    test("exact appRoot becomes dot", () => {
      const s = makeSerializer({ appRoot: "/app/project" });
      const output = s.serialize({ path: "/app/project" }, METADATA);

      expect(output).toContain("path: .");
    });
  });

  describe("RegExp serialization", () => {
    test("regex without flags", () => {
      const s = makeSerializer();
      const output = s.serialize({ test: /\.js$/ }, METADATA);

      expect(output).toContain("test: \\.js$");
    });

    test("regex with flags adds comment", () => {
      const s = makeSerializer();
      const output = s.serialize({ test: /\.css$/gi }, METADATA);

      expect(output).toContain("# flags: gi");
    });
  });

  describe("function serialization", () => {
    test("serializes named function", () => {
      const s = makeSerializer();
      function myTransform() {
        return true;
      }
      const output = s.serialize({ transform: myTransform }, METADATA);

      expect(output).toContain("myTransform");
    });

    test("serializes arrow function", () => {
      const s = makeSerializer();
      const fn = () => 42;
      const output = s.serialize({ compute: fn }, METADATA);

      expect(output).toContain("compute:");
      expect(output).toContain("42");
    });

    test("truncates functions longer than 50 lines with ellipsis", () => {
      const s = makeSerializer();

      // Create a function and override toString to simulate a very long source
      const longLines = Array.from({ length: 60 }, (_, i) => `  void(${i})`);
      const longSource = `function longFn() {\n${longLines.join("\n")}\n}`;
      function placeholder() {}
      placeholder.toString = () => longSource;

      const output = s.serialize({ fn: placeholder }, METADATA);

      expect(output).toContain("...");
      // Should not contain line 59 (0-indexed: lines beyond the 50-line cutoff)
      expect(output).not.toContain("void(59)");
    });
  });

  describe("array serialization", () => {
    test("empty array serializes as []", () => {
      const s = makeSerializer();
      const output = s.serialize({ items: [] }, METADATA);

      expect(output).toContain("items: []");
    });

    test("simple value arrays use dash notation", () => {
      const s = makeSerializer();
      const output = s.serialize({ items: ["a", "b", "c"] }, METADATA);

      expect(output).toContain("- a");
      expect(output).toContain("- b");
      expect(output).toContain("- c");
    });

    test("annotates plugin constructor names in plugins array", () => {
      class MyPlugin {}
      const s = makeSerializer();
      const output = s.serialize({ plugins: [new MyPlugin()] }, METADATA);

      expect(output).toContain("# MyPlugin");
    });
  });

  describe("object serialization", () => {
    test("empty object serializes as {}", () => {
      const s = makeSerializer();
      const output = s.serialize({ optimization: {} }, METADATA);

      expect(output).toContain("optimization: {}");
    });

    test("empty class instance includes constructor name", () => {
      class TerserPlugin {}
      const s = makeSerializer();
      const output = s.serialize({ plugin: new TerserPlugin() }, METADATA);

      expect(output).toContain("{} # TerserPlugin");
    });

    test("keys preserve insertion order", () => {
      const s = makeSerializer();
      const output = s.serialize({ z: 1, a: 2, m: 3 }, METADATA);

      const zIndex = output.indexOf("z: 1");
      const aIndex = output.indexOf("a: 2");
      const mIndex = output.indexOf("m: 3");

      expect(zIndex).toBeLessThan(aIndex);
      expect(aIndex).toBeLessThan(mIndex);
    });

    test("special characters in keys are quoted", () => {
      const s = makeSerializer();
      const output = s.serialize({ "key:with:colons": 1, normal: 2 }, METADATA);

      expect(output).toContain('"key:with:colons": 1');
      expect(output).toContain("normal: 2");
    });

    test("nested objects are indented", () => {
      const s = makeSerializer();
      const output = s.serialize({ output: { filename: "bundle.js" } }, METADATA);

      expect(output).toContain("output:");
      expect(output).toContain("  filename: bundle.js");
    });
  });

  describe("annotate mode", () => {
    test("injects doc comments for known keys", () => {
      const s = makeSerializer({ annotate: true });
      const output = s.serialize({ mode: "production" }, METADATA);

      expect(output).toContain("# Defines the environment mode");
    });

    test("no doc comments when annotate is false", () => {
      const s = makeSerializer({ annotate: false });
      const output = s.serialize({ mode: "production" }, METADATA);

      const lines = output.split("\n").filter((l) => l.includes("Defines the environment mode"));
      expect(lines).toHaveLength(0);
    });
  });

  describe("special types", () => {
    test("serializes symbol", () => {
      const s = makeSerializer();
      const output = s.serialize({ sym: Symbol("test") }, METADATA);

      expect(output).toContain("sym: Symbol(test)");
    });

    test("serializes bigint", () => {
      const s = makeSerializer();
      const output = s.serialize({ big: BigInt(42) }, METADATA);

      expect(output).toContain("big: 42");
    });
  });
});

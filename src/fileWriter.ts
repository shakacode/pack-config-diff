import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname, relative, isAbsolute, basename } from "path";
import { tmpdir } from "os";

import type { FileOutput } from "./types";

export class FileWriter {
  static writeMultipleFiles(outputs: FileOutput[], targetDir: string): void {
    FileWriter.validateOutputPath(resolve(targetDir, "probe"));
    FileWriter.ensureDirectory(targetDir);

    const seenNames = new Set<string>();
    outputs.forEach((output) => {
      const safeName = basename(output.filename);
      if (seenNames.has(safeName)) {
        throw new Error(
          `Filename collision: multiple outputs resolve to "${safeName}". Use distinct build names or config types.`,
        );
      }
      seenNames.add(safeName);
      const filePath = resolve(targetDir, safeName);
      FileWriter.validateOutputPath(filePath);
      FileWriter.writeFile(filePath, output.content);
      console.log(`[pack-config-diff] Created: ${filePath}`);
    });

    console.log(`[pack-config-diff] Exported ${outputs.length} config file(s) to ${targetDir}`);
  }

  static writeSingleFile(filePath: string, content: string): void {
    FileWriter.validateOutputPath(filePath);

    const dir = dirname(filePath);
    FileWriter.ensureDirectory(dir);
    FileWriter.writeFile(filePath, content);
  }

  static generateFilename(
    bundler: string,
    env: string,
    configType: string,
    format: "yaml" | "json" | "inspect",
    buildName?: string,
  ): string {
    let ext: string;
    if (format === "yaml") {
      ext = "yml";
    } else if (format === "json") {
      ext = "json";
    } else {
      ext = "txt";
    }

    // eslint-disable-next-line no-control-regex
    const sanitize = (s: string): string => s.replace(/[/\\:*?"<>|\x00-\x1f]/g, "_");
    const name = buildName || env;
    return `${sanitize(bundler)}-${sanitize(name)}-${sanitize(configType)}.${ext}`;
  }

  private static writeFile(filePath: string, content: string): void {
    writeFileSync(filePath, content, "utf8");
  }

  private static ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  static validateOutputPath(outputPath: string): void {
    const absPath = resolve(outputPath);
    const cwd = process.cwd();

    const isWithin = (base: string, target: string): boolean => {
      const rel = relative(base, target);
      return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
    };

    if (!isWithin(cwd, absPath) && !isWithin(tmpdir(), absPath)) {
      throw new Error(
        `Refusing to write to ${absPath} — path is outside current directory (${cwd}) and temp directory (${tmpdir()})`,
      );
    }
  }
}

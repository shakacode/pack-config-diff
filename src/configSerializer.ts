import { inspect } from "util";

import { YamlSerializer } from "./yamlSerializer";
import type { DumpMetadata, SerializeOptions } from "./types";

function getSerializableConstructorName(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  try {
    const proto = Object.getPrototypeOf(value) as { constructor?: { name?: string } } | null;
    if (!proto || proto === Object.prototype) {
      return null;
    }

    const { constructor } = proto;
    if (!constructor || typeof constructor !== "function") {
      return null;
    }

    const constructorName = constructor.name;
    if (!constructorName || constructorName === "Object" || constructorName === "Array") {
      return null;
    }

    return constructorName;
  } catch {
    return null;
  }
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return `[BigInt: ${value.toString()}]`;
  }

  if (typeof value === "function") {
    return `[Function: ${value.name || "anonymous"}]`;
  }

  if (value instanceof RegExp) {
    return `[RegExp: ${value.toString()}]`;
  }

  const constructorName = getSerializableConstructorName(value);
  if (constructorName) {
    return `[${constructorName}]`;
  }

  return value;
}

function serializeInspect(config: unknown, metadata: DumpMetadata, depth?: number | null): string {
  const inspectOptions = {
    depth: depth === undefined ? 20 : depth,
    colors: false,
    maxArrayLength: null,
    maxStringLength: null,
    breakLength: 120,
    compact: false,
  };

  let output = `=== METADATA ===\n\n${inspect(metadata, inspectOptions)}\n\n`;
  output += "=== CONFIG ===\n\n";

  if (Array.isArray(config)) {
    output += `Total configs: ${config.length}\n\n`;
    config.forEach((cfg, index) => {
      output += `--- Config [${index}] ---\n\n`;
      output += `${inspect(cfg, inspectOptions)}\n\n`;
    });
  } else {
    output += `${inspect(config, inspectOptions)}\n`;
  }

  return output;
}

export function serializeConfig(
  config: unknown,
  metadata: DumpMetadata,
  options: SerializeOptions,
): string {
  if (options.format === "yaml") {
    const serializer = new YamlSerializer({
      annotate: Boolean(options.annotate),
      appRoot: options.appRoot || process.cwd(),
    });
    return serializer.serialize(config, metadata);
  }

  if (options.format === "json") {
    return JSON.stringify({ metadata, config }, jsonReplacer, 2);
  }

  return serializeInspect(config, metadata, options.depth);
}

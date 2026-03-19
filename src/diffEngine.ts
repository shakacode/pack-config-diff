import { DiffOperation, DiffEntry, DiffResult, DiffOptions, DiffPath } from "./types";

export class DiffEngine {
  private options: Required<DiffOptions>;

  private entries: DiffEntry[] = [];

  constructor(options: DiffOptions = {}) {
    this.options = {
      includeUnchanged: options.includeUnchanged ?? false,
      maxDepth: options.maxDepth ?? null,
      ignoreKeys: options.ignoreKeys ?? [],
      ignorePaths: options.ignorePaths ?? [],
      format: options.format ?? "detailed",
      normalizePaths: options.normalizePaths ?? true,
      pathSeparator: options.pathSeparator ?? ".",
      pluginAware: options.pluginAware ?? false,
      matchRulesByTest: options.matchRulesByTest ?? false,
    };
  }

  compare(left: any, right: any, metadata?: any): DiffResult {
    this.entries = [];
    this.compareValues(left, right, []);

    const summary = this.calculateSummary();

    return {
      summary,
      entries: this.entries,
      metadata: {
        comparedAt: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  private compareValues(left: any, right: any, path: string[], depth: number = 0): void {
    if (this.shouldIgnorePath(path)) {
      return;
    }

    if (this.options.maxDepth !== null && depth > this.options.maxDepth) {
      return;
    }

    const leftType = this.getValueType(left);
    const rightType = this.getValueType(right);

    if (left === undefined && right === undefined) {
      return;
    }

    if (left === undefined) {
      this.addEntry("added", path, undefined, right, rightType);
      return;
    }

    if (right === undefined) {
      this.addEntry("removed", path, left, undefined, leftType);
      return;
    }

    if (this.isPrimitive(left) || this.isPrimitive(right)) {
      if (!this.areEqual(left, right)) {
        this.addEntry("changed", path, left, right, leftType);
      } else if (this.options.includeUnchanged) {
        this.addEntry("unchanged", path, left, right, leftType);
      }
      return;
    }

    if (Array.isArray(left) && Array.isArray(right)) {
      this.compareArrays(left, right, path, depth);
      return;
    }

    if (this.isPlainObject(left) && this.isPlainObject(right)) {
      this.compareObjects(left, right, path, depth);
      return;
    }

    if (!this.areEqual(left, right)) {
      this.addEntry("changed", path, left, right, leftType);
    } else if (this.options.includeUnchanged) {
      this.addEntry("unchanged", path, left, right, leftType);
    }
  }

  private compareObjects(
    left: Record<string, any>,
    right: Record<string, any>,
    path: string[],
    depth: number,
  ): void {
    const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);

    for (const key of allKeys) {
      if (!this.options.ignoreKeys.includes(key)) {
        const newPath = [...path, key];
        this.compareValues(left[key], right[key], newPath, depth + 1);
      }
    }
  }

  private compareArrays(left: any[], right: any[], path: string[], depth: number): void {
    if (this.shouldMatchRulesByTest(path)) {
      this.compareModuleRulesByTest(left, right, path, depth);
      return;
    }

    const maxLength = Math.max(left.length, right.length);

    for (let i = 0; i < maxLength; i += 1) {
      const newPath = [...path, `[${i}]`];
      this.compareValues(left[i], right[i], newPath, depth + 1);
    }
  }

  private shouldMatchRulesByTest(path: string[]): boolean {
    return (
      this.options.matchRulesByTest &&
      path.length >= 2 &&
      path[path.length - 2] === "module" &&
      path[path.length - 1] === "rules"
    );
  }

  private compareModuleRulesByTest(left: any[], right: any[], path: string[], depth: number): void {
    const leftByTest = this.indexRulesByTest(left);
    const rightByTest = this.indexRulesByTest(right);
    const allKeys = Array.from(new Set([...leftByTest.keys(), ...rightByTest.keys()])).sort();

    for (const key of allKeys) {
      this.compareValues(
        leftByTest.get(key),
        rightByTest.get(key),
        [...path, `{${key}}`],
        depth + 1,
      );
    }
  }

  private indexRulesByTest(rules: any[]): Map<string, any> {
    const indexed = new Map<string, any>();
    const occurrences = new Map<string, number>();

    rules.forEach((rule, index) => {
      const baseKey = this.getRuleKey(rule, index);
      const occurrence = occurrences.get(baseKey) ?? 0;
      occurrences.set(baseKey, occurrence + 1);
      const key = occurrence === 0 ? baseKey : `${baseKey}#${occurrence}`;
      indexed.set(key, rule);
    });

    return indexed;
  }

  private getRuleKey(rule: any, index: number): string {
    if (!this.isPlainObject(rule) || rule.test === undefined) {
      return `index:${index}`;
    }

    if (rule.test instanceof RegExp) {
      return `test:${rule.test.toString()}`;
    }

    if (typeof rule.test === "string") {
      return `test:${rule.test}`;
    }

    return `test:${String(rule.test)}`;
  }

  private addEntry(
    operation: DiffOperation,
    path: string[],
    oldValue: any,
    newValue: any,
    valueType?: string,
  ): void {
    const entry: DiffEntry = {
      operation,
      path: this.formatPath(path),
      oldValue: this.serializeValue(oldValue),
      newValue: this.serializeValue(newValue),
      valueType: valueType || this.getValueType(newValue || oldValue),
    };

    this.entries.push(entry);
  }

  private formatPath(path: string[]): DiffPath {
    return {
      path,
      humanPath: this.createHumanPath(path),
    };
  }

  private createHumanPath(path: string[]): string {
    if (path.length === 0) {
      return "(root)";
    }

    return path.join(this.options.pathSeparator);
  }

  private shouldIgnorePath(path: string[]): boolean {
    const humanPath = this.createHumanPath(path);
    return this.options.ignorePaths.some((ignorePath) => {
      if (ignorePath.includes("*")) {
        const escapedPattern = ignorePath
          .split("*")
          .map((segment) => this.escapeRegExp(segment))
          .join(".*");

        try {
          const pattern = new RegExp(`^${escapedPattern}$`);
          return pattern.test(humanPath);
        } catch {
          return false;
        }
      }
      return (
        humanPath === ignorePath ||
        humanPath.startsWith(`${ignorePath}${this.options.pathSeparator}`)
      );
    });
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private isPrimitive(value: any): boolean {
    return (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "undefined" ||
      typeof value === "function" ||
      value instanceof RegExp
    );
  }

  private isPlainObject(value: any): boolean {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      value instanceof RegExp ||
      value instanceof Date
    ) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  private areEqual(left: any, right: any): boolean {
    if (left === right) {
      return true;
    }

    if (this.options.pluginAware && this.isClassInstance(left) && this.isClassInstance(right)) {
      return this.arePluginInstancesEqual(left, right);
    }

    if (typeof left === "function" && typeof right === "function") {
      return left.toString() === right.toString();
    }

    if (left instanceof RegExp && right instanceof RegExp) {
      return left.toString() === right.toString();
    }

    if (left instanceof Date && right instanceof Date) {
      return left.getTime() === right.getTime();
    }

    return false;
  }

  private isClassInstance(value: any): boolean {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      value instanceof RegExp ||
      value instanceof Date
    ) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype !== Object.prototype && prototype !== null;
  }

  private arePluginInstancesEqual(left: any, right: any): boolean {
    if (left?.constructor !== right?.constructor) {
      return false;
    }

    const leftSnapshot = this.snapshotPluginInstance(left);
    const rightSnapshot = this.snapshotPluginInstance(right);

    return leftSnapshot === rightSnapshot;
  }

  private snapshotPluginInstance(instance: any): string {
    const ancestors = new WeakSet<object>();
    return JSON.stringify(this.normalizeComparableValue(instance, ancestors));
  }

  private normalizeComparableValue(value: any, ancestors: WeakSet<object>): any {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (value === undefined) {
      return "[Undefined]";
    }

    if (typeof value === "function") {
      return `[Function:${value.name || "anonymous"}:${value.toString()}]`;
    }

    if (value instanceof RegExp) {
      return `[RegExp:${value.toString()}]`;
    }

    if (value instanceof Date) {
      return `[Date:${value.toISOString()}]`;
    }

    if (typeof value === "object") {
      if (ancestors.has(value)) {
        return "[Circular]";
      }
      ancestors.add(value);

      try {
        if (Array.isArray(value)) {
          return value.map((item) => this.normalizeComparableValue(item, ancestors));
        }

        if (value instanceof Map) {
          const normalizedEntries = Array.from(value.entries()).map(([mapKey, mapValue]) => ({
            key: this.normalizeComparableValue(mapKey, ancestors),
            value: this.normalizeComparableValue(mapValue, ancestors),
          }));
          normalizedEntries.sort((first, second) =>
            JSON.stringify(first.key).localeCompare(JSON.stringify(second.key)),
          );

          return {
            __kind: "Map",
            entries: normalizedEntries,
          };
        }

        if (value instanceof Set) {
          const normalizedValues = Array.from(value.values()).map((item) =>
            this.normalizeComparableValue(item, ancestors),
          );
          normalizedValues.sort((first, second) =>
            JSON.stringify(first).localeCompare(JSON.stringify(second)),
          );

          return {
            __kind: "Set",
            values: normalizedValues,
          };
        }

        if (this.isPlainObject(value)) {
          const normalized: Record<string, any> = {};
          const keys = Object.keys(value).sort();
          for (const key of keys) {
            normalized[key] = this.normalizeComparableValue(value[key], ancestors);
          }
          return normalized;
        }

        if (this.isClassInstance(value)) {
          const normalized: Record<string, any> = {};
          const keys = Object.keys(value).sort();
          for (const key of keys) {
            normalized[key] = this.normalizeComparableValue(value[key], ancestors);
          }
          return {
            __kind: "Instance",
            constructorName: value.constructor?.name || "Anonymous",
            properties: normalized,
          };
        }
      } finally {
        ancestors.delete(value);
      }
    }

    return `[Unsupported:${String(value)}]`;
  }

  private getValueType(value: any): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";
    if (value instanceof RegExp) return "regexp";
    if (value instanceof Date) return "date";
    if (typeof value === "function") return "function";
    return typeof value;
  }

  private serializeValue(value: any): any {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "function") {
      const fnStr = value.toString();
      if (fnStr.length > 200) {
        return `[Function: ${value.name || "anonymous"}] (${fnStr.length} chars)`;
      }
      return `[Function: ${value.name || "anonymous"}]`;
    }

    if (value instanceof RegExp) {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return `[Array(${value.length})]`;
    }

    if (this.isPlainObject(value)) {
      const keys = Object.keys(value);
      return `[Object: ${keys.length} keys]`;
    }

    if (value && typeof value === "object" && value.constructor?.name) {
      return `[Instance: ${value.constructor.name}]`;
    }

    return value;
  }

  private calculateSummary(): DiffResult["summary"] {
    const summary: {
      totalChanges: number;
      added: number;
      removed: number;
      changed: number;
      unchanged?: number;
    } = {
      totalChanges: 0,
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 0,
    };

    for (const entry of this.entries) {
      if (entry.operation === "added") {
        summary.added += 1;
      } else if (entry.operation === "removed") {
        summary.removed += 1;
      } else if (entry.operation === "changed") {
        summary.changed += 1;
      } else if (entry.operation === "unchanged") {
        summary.unchanged = (summary.unchanged || 0) + 1;
      }

      if (entry.operation !== "unchanged") {
        summary.totalChanges += 1;
      }
    }

    if (!this.options.includeUnchanged) {
      delete summary.unchanged;
    }

    return summary;
  }
}

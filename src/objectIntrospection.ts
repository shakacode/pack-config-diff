export function getConstructorName(value: unknown): string | null {
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

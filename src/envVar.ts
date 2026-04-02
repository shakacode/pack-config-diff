export function isValidEnvVarName(name: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/i.test(name);
}

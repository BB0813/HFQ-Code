export function lookup(map: Record<string, string> | null, key: string): string {
  const value = map[key];
  return value.toUpperCase();
}

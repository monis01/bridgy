export function makeId(prefix = 'b'): string {
  // simple short id, no dependency
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

export function isOriginAllowed(origin: string, allowed?: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return false;
  if (allowed.includes('*')) return true;
  return allowed.includes(origin);
}

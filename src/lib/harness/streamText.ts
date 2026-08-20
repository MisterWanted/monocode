/** Join a delta or snapshot onto streamed text without repeating overlapping words. */
export function mergeStream(existing: string, incoming: string): string {
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (incoming === existing) return existing;
  if (incoming.startsWith(existing)) return incoming;
  if (existing.endsWith(incoming)) return existing;

  const trimmed = incoming.trimStart();
  // Cursor can emit blank lines as standalone deltas. Never deduplicate those
  // against the empty string: every string technically ends with `""`.
  if (trimmed && trimmed !== incoming) {
    if (trimmed === existing || existing.endsWith(trimmed)) return existing;
    if (trimmed.startsWith(existing)) return trimmed;
  }

  const maxOverlap = Math.min(existing.length, incoming.length, 1024);
  for (let k = maxOverlap; k > 0; k--) {
    if (existing.endsWith(incoming.slice(0, k))) {
      return existing + incoming.slice(k);
    }
  }
  return existing + incoming;
}

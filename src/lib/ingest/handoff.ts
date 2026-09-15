/**
 * In-memory handoff used when an import turns out to be a two-person chat and
 * should continue as a Deep Read.
 *
 * Deliberately a module variable: nothing is written to localStorage, session
 * storage, cookies or the network, and reading it clears it.
 */

type Handoff = { text: string; createdAt: number } | null;

let pending: Handoff = null;

export function setDeepReadHandoff(text: string) {
  pending = { text, createdAt: Date.now() };
}

/** Returns the pending transcript once, then forgets it. */
export function takeDeepReadHandoff(): string | null {
  if (!pending) return null;
  const stale = Date.now() - pending.createdAt > 5 * 60 * 1000;
  const { text } = pending;
  pending = null;
  return stale ? null : text;
}

export function clearDeepReadHandoff() {
  pending = null;
}

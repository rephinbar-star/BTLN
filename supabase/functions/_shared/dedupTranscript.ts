// Screenshot overlap handling.
//
// Screenshots of the same conversation frequently overlap at the seams: the
// bottom of image N shows the same bubbles as the top of image N+1. Removing
// those is correct. Removing *every* repeated line is not — "OK", "yes",
// "haha" legitimately recur, and untimestamped repeats carry no evidence that
// they are the same message.
//
// Rules applied here:
//   1. Exact duplicates that carry a non-empty timestamp are true duplicates
//      (same sender, same clock reading, same text) and are removed.
//   2. A contiguous run of two or more messages that immediately repeats the
//      run before it is a demonstrated seam overlap and is removed.
//   3. Anything else is KEPT. Identical untimestamped single messages are
//      surfaced as an ambiguity warning instead of being deleted.

export type DedupInput = { label: string; content: string; timestamp: string | null };

export type DedupResult = {
  lines: string[];
  removedDuplicates: number;
  removedOverlap: number;
  ambiguousRepeats: number;
  warnings: string[];
};

const MAX_SEAM = 25;

export function dedupeTranscript(input: DedupInput[]): DedupResult {
  const items = input
    .map((item) => ({ label: item.label.trim(), content: item.content.trim(), timestamp: (item.timestamp ?? "").trim() }))
    .filter((item) => item.content.length > 0);

  // Rule 1 — timestamped exact duplicates.
  const seen = new Set<string>();
  let removedDuplicates = 0;
  const afterTimestamped: typeof items = [];
  for (const item of items) {
    if (item.timestamp) {
      const key = `${item.label}|${item.timestamp}|${item.content}`;
      if (seen.has(key)) { removedDuplicates += 1; continue; }
      seen.add(key);
    }
    afterTimestamped.push(item);
  }

  // Rule 2 — demonstrated seam overlap (a run repeating the run before it).
  const identity = (item: { label: string; content: string }) => `${item.label}\u0000${item.content}`;
  const kept: typeof afterTimestamped = [];
  let removedOverlap = 0;
  let index = 0;
  while (index < afterTimestamped.length) {
    let matched = 0;
    const maxK = Math.min(MAX_SEAM, kept.length, afterTimestamped.length - index);
    for (let k = maxK; k >= 2; k -= 1) {
      let equal = true;
      for (let offset = 0; offset < k; offset += 1) {
        if (identity(kept[kept.length - k + offset]) !== identity(afterTimestamped[index + offset])) { equal = false; break; }
      }
      if (equal) { matched = k; break; }
    }
    if (matched) { removedOverlap += matched; index += matched; continue; }
    kept.push(afterTimestamped[index]);
    index += 1;
  }

  // Rule 3 — surface, never delete, untimestamped identical repeats.
  const counts = new Map<string, number>();
  for (const item of kept) {
    if (item.timestamp) continue;
    const key = identity(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let ambiguousRepeats = 0;
  for (const count of counts.values()) if (count > 1) ambiguousRepeats += count - 1;

  const warnings: string[] = [];
  const removedTotal = removedDuplicates + removedOverlap;
  if (removedTotal) {
    warnings.push(`${removedTotal} overlapping message${removedTotal === 1 ? "" : "s"} appearing in more than one screenshot ${removedTotal === 1 ? "was" : "were"} merged.`);
  }
  if (ambiguousRepeats) {
    warnings.push(`${ambiguousRepeats} repeated message${ambiguousRepeats === 1 ? " has" : "s have"} the same text with no timestamp. They were kept as separate messages — remove any you did not send twice.`);
  }

  return {
    lines: kept.map((item) => `${item.label}: ${item.content}`),
    removedDuplicates,
    removedOverlap,
    ambiguousRepeats,
    warnings,
  };
}

interface BaseTranscriptEntry {
  role: string;
  content: string;
}

/**
 * Merge an incoming partial transcript (≤5 entries from Retell SDK)
 * into our accumulated full transcript without losing earlier messages.
 *
 * The SDK's `update` event only sends the last ~5 utterances. We detect
 * the overlap between what we already have and the incoming slice, then
 * splice them together so nothing is lost.
 */
export function mergeTranscript<T extends BaseTranscriptEntry>(
  accumulated: T[],
  incoming: T[]
): T[] {
  if (!incoming.length) return accumulated;
  if (!accumulated.length) return incoming;

  const first = incoming[0];

  // Scan backwards through accumulated to find the overlap point:
  // an entry with the same role whose content is a prefix of (or equal to)
  // the incoming first entry's content.
  for (let i = accumulated.length - 1; i >= 0; i--) {
    if (
      accumulated[i].role === first.role &&
      first.content.startsWith(accumulated[i].content)
    ) {
      // Keep everything before the overlap, then append incoming
      return [...accumulated.slice(0, i), ...incoming];
    }
  }

  // No overlap found — these are entirely new turns, append them all
  return [...accumulated, ...incoming];
}

/**
 * Basic cleanup of raw ASR transcript text.
 * - Trims whitespace
 * - Capitalises first letter
 * - Collapses multiple spaces
 * - Adds trailing period if no sentence-ending punctuation is present
 *   (only when `finalized` is true — skip for the active/last utterance)
 */
export function cleanTranscriptText(
  text: string,
  finalized: boolean = true
): string {
  let cleaned = text.trim().replace(/\s{2,}/g, " ");
  if (!cleaned) return cleaned;

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Add trailing punctuation for finalized entries
  if (finalized && !/[.!?]$/.test(cleaned)) {
    cleaned += ".";
  }

  return cleaned;
}

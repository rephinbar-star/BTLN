/**
 * Declared ingestion limits. These are the numbers the UI shows, the client
 * enforces, and the edge functions re-enforce server-side. Changing a number
 * here does NOT relax the server: analyze-group keeps its own copies.
 */

export const LIMITS = {
  /** Largest plain-text export accepted. */
  MAX_TEXT_FILE_BYTES: 10 * 1024 * 1024,
  /** Largest .zip accepted (checked before the archive is opened). */
  MAX_ZIP_FILE_BYTES: 20 * 1024 * 1024,
  /** Largest single entry we will decompress out of a .zip. */
  MAX_ZIP_ENTRY_BYTES: 12 * 1024 * 1024,
  /** Largest total declared uncompressed size across scanned entries. */
  MAX_ZIP_TOTAL_BYTES: 40 * 1024 * 1024,
  /** Highest uncompressed:compressed ratio tolerated (zip-bomb guard). */
  MAX_ZIP_EXPANSION_RATIO: 150,
  /** Most entries we will even look at inside an archive. */
  MAX_ZIP_ENTRIES: 2000,
  /** Largest decoded transcript, in characters. */
  MAX_TEXT_CHARS: 8_000_000,
  /** Most messages the browser parser will keep. */
  MAX_PARSED_MESSAGES: 60_000,
  /** Most messages sent to the Group Read backend in one job. */
  MAX_GROUP_UPLOAD_MESSAGES: 12_000,
  /** Character budget for the payload sent to the Group Read backend. */
  MAX_GROUP_UPLOAD_CHARS: 1_800_000,
  /** Messages the model actually reads (the rest feed deterministic stats). */
  MAX_MODEL_SAMPLE_MESSAGES: 1_200,
  /** Character budget for the model transcript sample. */
  MAX_MODEL_SAMPLE_CHARS: 90_000,
  /** Longest single message kept, in characters. */
  MAX_MESSAGE_CHARS: 2_000,
  GROUP_MIN_PARTICIPANTS: 3,
  GROUP_MAX_PARTICIPANTS: 15,
  GROUP_MIN_MESSAGES: 10,
} as const;

export const fmtBytes = (n: number): string =>
  n >= 1024 * 1024 ? `${Math.round(n / (1024 * 1024))} MB` : `${Math.round(n / 1024)} KB`;

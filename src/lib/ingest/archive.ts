/**
 * Bounded .zip handling for WhatsApp exports.
 *
 * Guards run on entry metadata BEFORE anything is decompressed: declared
 * uncompressed size, expansion ratio, entry count, path traversal and nested
 * archives. Media files are listed but never read, decoded or uploaded.
 */

import { LIMITS } from "./limits";
import { UnsupportedFileError } from "./decode";

export type TranscriptCandidate = {
  name: string;
  /** Declared uncompressed size in bytes. */
  bytes: number;
};

export type ArchiveScan = {
  candidates: TranscriptCandidate[];
  /** Media/other entries that were ignored without being read. */
  ignored: number;
  warnings: string[];
};

const ARCHIVE_EXT = /\.(zip|rar|7z|gz|tar|tgz|bz2|xz)$/i;
const TEXT_EXT = /\.(txt|csv)$/i;

const isUnsafePath = (name: string) =>
  name.startsWith("/") ||
  /^[a-zA-Z]:[\\/]/.test(name) ||
  name.split(/[\\/]/).some((seg) => seg === "..");

type ZipEntryLike = {
  name: string;
  dir: boolean;
  // jszip keeps sizes on the internal data holder
  _data?: { uncompressedSize?: number; compressedSize?: number };
};

/**
 * Inspect an archive and return the transcript entries worth offering.
 * Never decompresses anything.
 */
export function scanZipEntries(
  entries: ZipEntryLike[],
  fileBytes: number,
): ArchiveScan {
  if (entries.length > LIMITS.MAX_ZIP_ENTRIES) {
    throw new UnsupportedFileError(
      "That archive has too many files in it to be a chat export.",
    );
  }

  const warnings: string[] = [];
  const candidates: TranscriptCandidate[] = [];
  let ignored = 0;
  let totalDeclared = 0;

  for (const entry of entries) {
    if (entry.dir) continue;
    if (isUnsafePath(entry.name)) {
      throw new UnsupportedFileError(
        "That archive contains unsafe file paths, so we didn't open it.",
      );
    }
    if (ARCHIVE_EXT.test(entry.name)) {
      throw new UnsupportedFileError(
        "That archive contains another archive inside it. Please upload the chat export itself.",
      );
    }

    const size = entry._data?.uncompressedSize ?? 0;
    totalDeclared += size;
    if (totalDeclared > LIMITS.MAX_ZIP_TOTAL_BYTES) {
      throw new UnsupportedFileError(
        "That archive unpacks to far more data than we accept. Export a shorter date range.",
      );
    }

    if (!TEXT_EXT.test(entry.name)) {
      ignored += 1;
      continue;
    }
    if (size > LIMITS.MAX_ZIP_ENTRY_BYTES) {
      warnings.push(`Skipped "${entry.name}" — it's too large to process.`);
      continue;
    }
    candidates.push({ name: entry.name, bytes: size });
  }

  if (fileBytes > 0 && totalDeclared / fileBytes > LIMITS.MAX_ZIP_EXPANSION_RATIO) {
    throw new UnsupportedFileError(
      "That archive expands far more than a chat export should. We didn't open it.",
    );
  }

  if (candidates.length === 0) {
    throw new UnsupportedFileError(
      "We couldn't find a chat transcript (.txt or .csv) inside that archive.",
    );
  }

  if (ignored > 0) {
    warnings.push(
      `${ignored} media file${ignored === 1 ? "" : "s"} in the archive were ignored — we never open or upload them.`,
    );
  }

  // Biggest transcript first: in a WhatsApp export that's the real chat.
  candidates.sort((a, b) => b.bytes - a.bytes);
  return { candidates, ignored, warnings };
}

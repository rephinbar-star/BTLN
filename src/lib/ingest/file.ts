/**
 * Turn a user-selected file into transcript text, with all limits enforced
 * before anything is read. Nothing here uploads, stores or executes the file.
 */

import { LIMITS, fmtBytes } from "./limits";
import { decodeChatBytes, UnsupportedFileError } from "./decode";
import { scanZipEntries, type TranscriptCandidate } from "./archive";

export { UnsupportedFileError };

export type ReadFileResult =
  | { kind: "text"; text: string; encoding: string; warnings: string[]; sourceName: string }
  | { kind: "choose"; candidates: TranscriptCandidate[]; warnings: string[] };

const isZip = (file: File) =>
  file.name.toLowerCase().endsWith(".zip") ||
  file.type === "application/zip" ||
  file.type === "application/x-zip-compressed";

const isTextName = (file: File) => /\.(txt|csv)$/i.test(file.name);

export async function readChatFile(
  file: File,
  chosenEntry?: string,
): Promise<ReadFileResult> {
  if (isZip(file)) {
    if (file.size > LIMITS.MAX_ZIP_FILE_BYTES) {
      throw new UnsupportedFileError(
        `That archive is larger than ${fmtBytes(LIMITS.MAX_ZIP_FILE_BYTES)}. Export a shorter date range.`,
      );
    }
    const { default: JSZip } = await import("jszip");
    let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
    try {
      zip = await JSZip.loadAsync(file);
    } catch {
      throw new UnsupportedFileError(
        "We couldn't open that archive — it may be damaged or password-protected.",
      );
    }
    const entries = Object.values(zip.files) as unknown as Parameters<typeof scanZipEntries>[0];
    const scan = scanZipEntries(entries, file.size);

    if (!chosenEntry && scan.candidates.length > 1) {
      return { kind: "choose", candidates: scan.candidates, warnings: scan.warnings };
    }
    const target = chosenEntry ?? scan.candidates[0].name;
    const entry = zip.file(target);
    if (!entry) {
      throw new UnsupportedFileError("That chat file isn't in the archive any more.");
    }
    const bytes = new Uint8Array(await entry.async("arraybuffer"));
    if (bytes.byteLength > LIMITS.MAX_ZIP_ENTRY_BYTES) {
      throw new UnsupportedFileError("That transcript is too large to process.");
    }
    const decoded = decodeChatBytes(bytes);
    return {
      kind: "text",
      text: decoded.text,
      encoding: decoded.encoding,
      warnings: [...scan.warnings, ...decoded.warnings],
      sourceName: target,
    };
  }

  if (!isTextName(file) && file.type !== "text/plain" && file.type !== "text/csv") {
    throw new UnsupportedFileError(
      "Please upload a .txt or .csv chat export, or the .zip WhatsApp gives you.",
    );
  }
  if (file.size > LIMITS.MAX_TEXT_FILE_BYTES) {
    throw new UnsupportedFileError(
      `That file is larger than ${fmtBytes(LIMITS.MAX_TEXT_FILE_BYTES)}. Export a shorter date range.`,
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoded = decodeChatBytes(bytes);
  return {
    kind: "text",
    text: decoded.text,
    encoding: decoded.encoding,
    warnings: decoded.warnings,
    sourceName: file.name,
  };
}

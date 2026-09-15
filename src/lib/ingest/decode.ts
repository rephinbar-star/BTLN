/**
 * Bytes -> text, with explicit rejection of things that are not chat exports.
 *
 * File contents are never executed, never evaluated, and never uploaded from
 * here — decoding happens entirely in the browser's memory.
 */

import { LIMITS } from "./limits";

export class UnsupportedFileError extends Error {}

type Signature = { label: string; bytes: number[]; offset?: number };

const BINARY_SIGNATURES: Signature[] = [
  { label: "an iMessage chat.db database", bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66] },
  { label: "a Windows program", bytes: [0x4d, 0x5a] },
  { label: "a Linux program", bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { label: "a macOS program", bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { label: "a macOS program", bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { label: "a PDF", bytes: [0x25, 0x50, 0x44, 0x46] },
  { label: "a RAR archive", bytes: [0x52, 0x61, 0x72, 0x21] },
  { label: "a 7-Zip archive", bytes: [0x37, 0x7a, 0xbc, 0xaf] },
  { label: "a gzip archive", bytes: [0x1f, 0x8b] },
  { label: "an image", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { label: "an image", bytes: [0xff, 0xd8, 0xff] },
];

const startsWith = (bytes: Uint8Array, sig: number[]) =>
  bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);

/** Human-readable reason if these bytes are definitely not a text export. */
export function detectBinary(bytes: Uint8Array): string | null {
  for (const s of BINARY_SIGNATURES) {
    if (startsWith(bytes, s.bytes)) return s.label;
  }
  return null;
}

export type DecodedText = { text: string; encoding: string; warnings: string[] };

/**
 * Decode a chat export. Handles UTF-8 (with or without BOM) and UTF-16 with a
 * BOM; falls back to Windows-1252 with a warning when UTF-8 is invalid.
 */
export function decodeChatBytes(bytes: Uint8Array): DecodedText {
  const binary = detectBinary(bytes);
  if (binary) {
    throw new UnsupportedFileError(
      `That looks like ${binary}, not a chat export. WhatsApp and iMessage text exports only, please.`,
    );
  }

  const warnings: string[] = [];
  let encoding = "utf-8";
  let body = bytes;

  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) {
    body = bytes.subarray(3);
  } else if (startsWith(bytes, [0xff, 0xfe])) {
    encoding = "utf-16le";
    body = bytes.subarray(2);
  } else if (startsWith(bytes, [0xfe, 0xff])) {
    encoding = "utf-16be";
    body = bytes.subarray(2);
  }

  let text: string;
  if (encoding.startsWith("utf-16")) {
    text = new TextDecoder(encoding).decode(body);
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    } catch {
      encoding = "windows-1252";
      warnings.push(
        "This file isn't valid UTF-8, so we read it as Windows-1252. Some accents or emoji may look wrong.",
      );
      text = new TextDecoder("windows-1252").decode(body);
    }
  }

  // A text export should not contain NUL bytes.
  if (text.indexOf("\u0000") !== -1) {
    throw new UnsupportedFileError(
      "That file looks like binary data rather than a chat transcript.",
    );
  }

  if (text.length > LIMITS.MAX_TEXT_CHARS) {
    throw new UnsupportedFileError(
      `That transcript is larger than we can handle (over ${Math.round(
        LIMITS.MAX_TEXT_CHARS / 1_000_000,
      )} million characters). Export a shorter date range.`,
    );
  }

  return { text, encoding, warnings };
}

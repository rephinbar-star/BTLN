// Client-side image compression for screenshot uploads.
// Goal: keep the JSON payload sent to the Edge Function well under
// the per-request body limit (~6 MB), even when the user picks 6–15
// high-resolution phone screenshots.

const MAX_DIMENSION = 1600; // px on the long edge — plenty for OCR
const JPEG_QUALITY = 0.78;

const readAsDataURL = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });

/**
 * Compress an image File to a JPEG data URL no larger than MAX_DIMENSION on
 * the long edge. Falls back to the original data URL if compression fails
 * for any reason.
 */
export async function compressImage(file: File): Promise<string> {
  try {
    const originalDataUrl = await readAsDataURL(file);
    const img = await loadImage(originalDataUrl);

    const { width, height } = img;
    const longEdge = Math.max(width, height);
    const scale = longEdge > MAX_DIMENSION ? MAX_DIMENSION / longEdge : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return originalDataUrl;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const compressed = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    // Sanity check: only use compressed if it actually shrank.
    return compressed.length < originalDataUrl.length ? compressed : originalDataUrl;
  } catch {
    // Fall back to a plain data-URL read of the original.
    try {
      return await readAsDataURL(file);
    } catch {
      throw new Error(`Could not read ${file.name}`);
    }
  }
}

/**
 * Approximate decoded byte size of a base64 data URL.
 */
export const dataUrlByteSize = (dataUrl: string): number => {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const b64 = dataUrl.slice(comma + 1);
  // 4 base64 chars ≈ 3 bytes
  return Math.floor((b64.length * 3) / 4);
};
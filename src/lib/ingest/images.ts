import { compressImage, dataUrlByteSize } from "@/lib/image-compress";

export const SCREENSHOT_LIMITS = {
  maxCount: 30,
  maxFileBytes: 8 * 1024 * 1024,
  maxTotalBytes: 8 * 1024 * 1024,
} as const;

export const SCREENSHOT_ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

export type PreparedScreenshot = {
  id: string;
  name: string;
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
};

export class ScreenshotValidationError extends Error {}

export async function prepareScreenshot(file: File): Promise<PreparedScreenshot> {
  const lower = file.name.toLowerCase();
  if (/\.(heic|heif)$/.test(lower) || /heic|heif/.test(file.type)) {
    throw new ScreenshotValidationError("HEIC isn't supported yet. Save or share it as PNG, JPG or WebP, then upload that copy.");
  }
  if (!(["image/png", "image/jpeg", "image/webp"].includes(file.type) || /\.(png|jpe?g|webp)$/.test(lower))) {
    throw new ScreenshotValidationError(`“${file.name}” isn't a supported screenshot. Use PNG, JPG or WebP.`);
  }
  if (file.size > SCREENSHOT_LIMITS.maxFileBytes) {
    throw new ScreenshotValidationError(`“${file.name}” is over 8 MB. Crop it or save a smaller copy.`);
  }
  const prepared = await compressImage(file);
  const compressedBytes = dataUrlByteSize(prepared.dataUrl);
  if (!prepared.dataUrl.startsWith("data:image/")) {
    throw new ScreenshotValidationError(`We couldn't read “${file.name}”. Save it again as PNG, JPG or WebP.`);
  }
  return {
    id: crypto.randomUUID(),
    name: file.name,
    dataUrl: prepared.dataUrl,
    originalBytes: prepared.originalBytes,
    compressedBytes,
  };
}
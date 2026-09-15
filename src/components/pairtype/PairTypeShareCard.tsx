import { forwardRef } from "react";
import { fieldsFor, type PairTypeRow, type RelationshipType } from "@/lib/pairTypes";

export type ShareFormat = "square" | "story";

export const SHARE_SIZES: Record<ShareFormat, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: "1:1" },
  story: { width: 1080, height: 1920, label: "9:16" },
};

const hexToRgba = (hex: string, alpha: number) => {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

type Props = {
  row: PairTypeRow;
  relationship: RelationshipType;
  format: ShareFormat;
  /** Artwork pre-inlined as a data URL so canvas export never hits CORS. */
  imageDataUrl?: string | null;
  logoDataUrl?: string | null;
};

/**
 * Offscreen render target for downloadable share images.
 * Artwork uses object-contain and text has generous padding so nothing
 * important is cropped at either aspect ratio.
 */
export const PairTypeShareCard = forwardRef<HTMLDivElement, Props>(
  ({ row, relationship, format, imageDataUrl, logoDataUrl }, ref) => {
    const f = fieldsFor(row, relationship);
    const { width, height } = SHARE_SIZES[format];
    const story = format === "story";
    const art = story ? 820 : 520;

    return (
      <div
        ref={ref}
        style={{
          width,
          height,
          backgroundColor: row.background_color,
          color: row.text_color,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: story ? 44 : 28,
          padding: story ? "120px 90px" : "70px 80px",
          boxSizing: "border-box",
          fontFamily: "inherit",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: story ? 28 : 24,
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          Pair type
        </div>

        <div style={{ fontSize: story ? 82 : 66, fontWeight: 600, lineHeight: 1.05 }}>
          {f.name}
        </div>

        <div
          style={{
            fontSize: story ? 32 : 26,
            padding: story ? "14px 30px" : "10px 24px",
            borderRadius: 999,
            backgroundColor: hexToRgba(row.text_color, 0.1),
          }}
        >
          ⚡ {f.superpower}
        </div>

        {imageDataUrl && (
          <img
            src={imageDataUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: art,
              height: art,
              objectFit: "contain",
              borderRadius: 32,
            }}
          />
        )}

        <div style={{ fontSize: story ? 42 : 34, fontStyle: "italic", lineHeight: 1.25 }}>
          {f.tagline}
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 14,
            opacity: 0.8,
            fontSize: story ? 28 : 24,
          }}
        >
          {logoDataUrl && <img src={logoDataUrl} alt="" style={{ height: story ? 34 : 28 }} />}
          <span>betweenthelines.app</span>
        </div>
      </div>
    );
  },
);

PairTypeShareCard.displayName = "PairTypeShareCard";

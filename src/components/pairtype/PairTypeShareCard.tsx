import { forwardRef } from "react";
import { fieldsFor, RELATIONSHIP_LABELS, type PairTypeRow, type RelationshipType } from "@/lib/pairTypes";

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
 *
 * The illustration already carries the pair-type name, tagline and body copy,
 * so the surrounding frame stays deliberately light: a category label above,
 * identity + CTA below. Artwork is object-contain at the largest size the
 * safe margins allow — never cropped or stretched.
 *
 * Story safe margins: nothing but background in the top 240px / bottom 340px,
 * where Instagram and TikTok overlay their own UI.
 */
export const PairTypeShareCard = forwardRef<HTMLDivElement, Props>(
  ({ row, relationship, format, imageDataUrl, logoDataUrl }, ref) => {
    const f = fieldsFor(row, relationship);
    const { width, height } = SHARE_SIZES[format];
    const story = format === "story";
    const art = story ? 940 : 840;
    const muted = hexToRgba(row.text_color, 0.72);

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
          justifyContent: story ? "center" : "space-between",
          padding: story ? "240px 60px 340px" : "44px 60px 48px",
          boxSizing: "border-box",
          fontFamily: "inherit",
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: story ? 30 : 26,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: muted,
          }}
        >
          {RELATIONSHIP_LABELS[relationship]} pair type
        </div>

        {imageDataUrl ? (
          <img
            src={imageDataUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: art,
              height: art,
              objectFit: "contain",
              borderRadius: 28,
              margin: story ? "56px 0" : "0",
            }}
          />
        ) : (
          <div
            style={{
              width: art,
              height: art,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 28,
              fontSize: 64,
              fontWeight: 600,
              backgroundColor: hexToRgba(row.text_color, 0.08),
              margin: story ? "56px 0" : "0",
            }}
          >
            {f.name}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: story ? 46 : 38, fontWeight: 600, lineHeight: 1.1 }}>{f.name}</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: story ? 30 : 26,
              color: muted,
            }}
          >
            {logoDataUrl && <img src={logoDataUrl} alt="" style={{ height: story ? 32 : 28 }} />}
            <span>What&apos;s your pair type? betweenthelines.app</span>
          </div>
        </div>
      </div>
    );
  },
);

PairTypeShareCard.displayName = "PairTypeShareCard";

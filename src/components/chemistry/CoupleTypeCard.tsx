import { useState, type FC } from "react";
import {
  getCoupleTypeIllustrationUrl,
  pickFields,
  type CoupleType,
  type RelationshipType,
} from "@/lib/coupleTypes";
import { DecorativeElement } from "./DecorativeElement";

type Props = {
  type: CoupleType;
  relationship: RelationshipType;
};

// Convert a hex color to rgba with alpha (for muted body text).
const hexToRgba = (hex: string, alpha: number) => {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const CoupleTypeCard: FC<Props> = ({ type, relationship }) => {
  const fields = pickFields(type, relationship);
  const url = getCoupleTypeIllustrationUrl(type.id, relationship);
  const [imgError, setImgError] = useState(false);

  const mutedColor = hexToRgba(type.text_color, 0.7);

  return (
    <article
      className="relative mx-auto w-full max-w-[640px] overflow-hidden rounded-[24px] px-6 py-12 text-center shadow-[0_8px_32px_rgba(0,0,0,0.08)] sm:px-10 sm:py-14"
      style={{ backgroundColor: type.background_color, color: type.text_color }}
    >
      <DecorativeElement type={type.decorative_element} color={type.text_color} />

      <h1
        className="text-[34px] font-medium leading-tight tracking-tight sm:text-[44px]"
        style={{ color: type.text_color }}
      >
        {fields.name}
      </h1>

      <div
        className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium uppercase tracking-wide"
        style={{
          color: type.text_color,
          backgroundColor: hexToRgba(type.text_color, 0.08),
        }}
      >
        <span aria-hidden>⚡</span>
        <span>{fields.superpower}</span>
      </div>

      <div className="mx-auto mt-8 aspect-square w-full max-w-[360px] overflow-hidden rounded-[16px]">
        {url && !imgError ? (
          <img
            src={url}
            alt={`Illustration for ${fields.name}`}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-[64px] font-semibold"
            style={{
              backgroundColor: hexToRgba(type.text_color, 0.1),
              color: type.text_color,
            }}
          >
            {type.id}
          </div>
        )}
      </div>

      <p
        className="mx-auto mt-8 max-w-[480px] text-[18px] italic leading-snug sm:text-[20px]"
        style={{ color: type.text_color }}
      >
        {fields.tagline}
      </p>

      <p
        className="mx-auto mt-5 max-w-[520px] text-[15px] leading-relaxed sm:text-[16px]"
        style={{ color: mutedColor }}
      >
        {fields.description}
      </p>
    </article>
  );
};
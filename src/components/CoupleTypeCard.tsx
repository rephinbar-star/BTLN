import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export type CoupleTypeCardRelationship = "romantic" | "friend" | "family";

export type CoupleTypeCardProps = {
  /** couple_types.id (numeric in DB, accepted as number or string). */
  coupleTypeId: number | string;
  relationshipType: CoupleTypeCardRelationship;
  size?: "compact" | "full";
  className?: string;
};

type CoupleTypeRow = {
  id: number;
  romantic_name: string;
  friend_name: string;
  family_name: string;
  image_url_romantic: string | null;
  image_url_friend: string | null;
  image_url_family: string | null;
};

// Session-scoped cache so multiple cards on the same page only fetch each
// couple_type row once.
const cache = new Map<string, Promise<CoupleTypeRow | null>>();

const fetchType = (id: string): Promise<CoupleTypeRow | null> => {
  const existing = cache.get(id);
  if (existing) return existing;
  const p: Promise<CoupleTypeRow | null> = (async () => {
    const { data } = await supabase
      .from("couple_types")
      .select(
        "id, romantic_name, friend_name, family_name, image_url_romantic, image_url_friend, image_url_family",
      )
      .eq("id", Number(id))
      .maybeSingle();
    return (data as CoupleTypeRow | null) ?? null;
  })();
  cache.set(id, p);
  return p;
};

const nameFor = (row: CoupleTypeRow, rel: CoupleTypeCardRelationship) =>
  rel === "friend" ? row.friend_name : rel === "family" ? row.family_name : row.romantic_name;

const urlFor = (row: CoupleTypeRow, rel: CoupleTypeCardRelationship) =>
  rel === "friend"
    ? row.image_url_friend
    : rel === "family"
      ? row.image_url_family
      : row.image_url_romantic;

export const CoupleTypeCard = ({
  coupleTypeId,
  relationshipType,
  size = "full",
  className,
}: CoupleTypeCardProps) => {
  const [row, setRow] = useState<CoupleTypeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setImgFailed(false);
    fetchType(String(coupleTypeId)).then((data) => {
      if (cancelled) return;
      setRow(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [coupleTypeId]);

  const widthClass = size === "compact" ? "max-w-[200px]" : "max-w-full sm:max-w-[360px]";
  const containerClass = cn(
    "mx-auto w-full overflow-hidden rounded-[12px] border border-border bg-muted/30",
    widthClass,
    className,
  );

  if (loading) {
    return (
      <div className={containerClass}>
        <Skeleton className="aspect-square w-full" />
      </div>
    );
  }

  const url = row ? urlFor(row, relationshipType) : null;
  const label = row ? nameFor(row, relationshipType) : "";

  if (!url || imgFailed) {
    return (
      <div className={containerClass}>
        <div className="flex aspect-square w-full items-center justify-center bg-muted p-6 text-center text-[15px] font-medium text-muted-foreground">
          {label || "Couple type"}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <img
        src={url}
        alt={label ? `${label} illustration` : "Couple type illustration"}
        className="block aspect-square w-full object-cover"
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    </div>
  );
};

export default CoupleTypeCard;
import { useState } from "react";
import { Users, User } from "lucide-react";
import type { R360Relationship } from "@/lib/relationship360/types";

const CONTEXT_LABEL: Record<R360Relationship["context"], string> = {
  romantic: "Romantic",
  friend: "Friend",
  family: "Family",
  work: "Work",
};

type Props = {
  relationships: R360Relationship[];
  active: string | null;
  onSelect: (id: string | null) => void;
  countFor: (id: string) => number;
};

/**
 * "Your relationship landscape": you in the middle, the relationships you
 * labelled around you. Every spoke is the same length and the same weight —
 * position never encodes closeness, quality or any score. The list view below
 * carries exactly the same information for anyone who prefers it.
 */
export const RelationshipMap = ({ relationships, active, onSelect, countFor }: Props) => {
  const [view, setView] = useState<"map" | "list">("map");
  const n = Math.max(relationships.length, 1);

  const nodeAt = (index: number) => {
    const angle = (index / n) * 2 * Math.PI - Math.PI / 2;
    return { left: `${50 + 36 * Math.cos(angle)}%`, top: `${50 + 36 * Math.sin(angle)}%` };
  };

  const Item = ({ rel, index }: { rel: R360Relationship; index: number }) => {
    const selected = active === rel.id;
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(selected ? null : rel.id)}
        style={view === "map" ? { ...nodeAt(index), transform: "translate(-50%, -50%)" } : undefined}
        className={
          view === "map"
            ? `absolute flex min-h-11 min-w-11 max-w-[42%] flex-col items-center justify-center rounded-2xl border px-3 py-2 text-center transition-colors motion-reduce:transition-none ${selected ? "border-btln-forest bg-btln-forest text-btln-paper" : "border-btln-line bg-card"}`
            : `flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors motion-reduce:transition-none ${selected ? "border-btln-forest bg-btln-mint" : "border-btln-line bg-card"}`
        }
      >
        <span className="flex items-center gap-2 text-[14px] font-medium leading-tight">
          {rel.scope === "group" ? (
            <Users className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <User className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="break-words">{rel.label}</span>
        </span>
        <span className={`text-[12px] ${selected && view === "map" ? "text-btln-paper/80" : "text-muted-foreground"}`}>
          {CONTEXT_LABEL[rel.context]} · {countFor(rel.id)} included
        </span>
      </button>
    );
  };

  return (
    <section className="min-w-0" aria-labelledby="r360-landscape">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="r360-landscape" className="text-[18px] font-medium">
          Your relationship landscape
        </h2>
        <button
          type="button"
          onClick={() => setView((v) => (v === "map" ? "list" : "map"))}
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          {view === "map" ? "List view" : "Map view"}
        </button>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Every relationship sits the same distance from you. Distance and line weight carry no meaning —
        tap one to filter the profile, its evidence and its coaching.
      </p>

      {view === "map" ? (
        <div className="relative mx-auto mt-4 aspect-square w-full max-w-[330px]">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
            <circle cx="50" cy="50" r="36" fill="none" stroke="hsl(var(--border))" strokeWidth="0.4" strokeDasharray="1.5 2" />
            {relationships.map((rel, index) => {
              const angle = (index / n) * 2 * Math.PI - Math.PI / 2;
              return (
                <line
                  key={rel.id}
                  x1="50"
                  y1="50"
                  x2={50 + 36 * Math.cos(angle)}
                  y2={50 + 36 * Math.sin(angle)}
                  stroke="hsl(var(--border))"
                  strokeWidth="0.8"
                />
              );
            })}
          </svg>
          <div className="absolute left-1/2 top-1/2 flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-btln-mint text-[15px] font-medium">
            You
          </div>
          {relationships.map((rel, index) => (
            <Item key={rel.id} rel={rel} index={index} />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {relationships.map((rel, index) => (
            <Item key={rel.id} rel={rel} index={index} />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-pressed={active === null}
          onClick={() => onSelect(null)}
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Show everyone
        </button>
        {active && (
          <span className="text-[13px] text-muted-foreground">
            Filtered to {relationships.find((r) => r.id === active)?.label}
          </span>
        )}
      </div>
    </section>
  );
};

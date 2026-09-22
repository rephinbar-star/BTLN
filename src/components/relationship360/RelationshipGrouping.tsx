import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  assignSource,
  confirmRelationship,
  splitSource,
  suggestRelationships,
  type RelationshipSuggestion,
} from "@/lib/journey/api";
import type { JourneyRelationship, JourneySource } from "@/lib/journey/types";

/**
 * Grouping a new conversation.
 *
 * A conversation added automatically sits in an unresolved relationship until the
 * person says who it is about. We suggest relationships they already confirmed —
 * a suggestion is never an automatic merge, because a label is not an identity and
 * two people can share a name.
 */
export function RelationshipGrouping({
  relationship,
  sources,
  onChanged,
}: {
  relationship: JourneyRelationship;
  sources: JourneySource[];
  onChanged: () => void;
}) {
  const [suggestions, setSuggestions] = useState<RelationshipSuggestion[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const first = sources[0];

  useEffect(() => {
    let live = true;
    if (!first) return;
    suggestRelationships(first.id)
      .then((rows) => { if (live) setSuggestions(rows); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [first]);

  const run = async (work: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await work();
      onChanged();
    } catch (error) {
      toast({ title: failure, description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const periods = (
    <div className="mt-3 space-y-2">
      {sources.map((source) => (
        <SourcePeriod key={source.id} source={source} busy={busy} onChanged={onChanged} />
      ))}
    </div>
  );

  if (relationship.is_confirmed) {
    // Already resolved: the controls needed are the undo for a wrong grouping
    // and, where a conversation has no readable dates, a way to say when it was.
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border px-3 py-2">
        {sources.length >= 2 && (
          <>
            <p className="text-[13px] text-muted-foreground">Grouped these conversations by mistake?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sources.map((source) => (
                <Button
                  key={source.id}
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  className="min-h-[44px]"
                  onClick={() => run(() => splitSource(source.id, `${relationship.label} (separated)`), "Could not separate that conversation")}
                >
                  Separate this {source.source_kind.replace("_", " ")}
                </Button>
              ))}
            </div>
          </>
        )}
        {periods}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-btln-line bg-muted/40 px-3 py-3">
      <p className="text-[14px] font-medium text-foreground">Who is this conversation with?</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Until you say, this stays separate and is not counted as another relationship.
      </p>

      {suggestions.length > 0 && first && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion.id}
              size="sm"
              variant="outline"
              disabled={busy}
              className="min-h-[44px]"
              onClick={() => run(() => assignSource(first.id, suggestion.id), "Could not move that conversation")}
            >
              Same as “{suggestion.label}”
              {suggestion.reason === "same_conversation" ? " · same chat" : ""}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Name this relationship"
          aria-label="Name this relationship"
          className="h-11 max-w-[220px]"
        />
        <Button
          size="sm"
          disabled={busy || !label.trim()}
          className="min-h-[44px]"
          onClick={() => run(() => confirmRelationship(relationship.id, label.trim(), relationship.kind), "Could not save that name")}
        >
          New relationship
        </Button>
      </div>
    </div>
  );
}

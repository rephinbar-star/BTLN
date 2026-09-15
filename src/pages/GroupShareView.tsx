import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";
import { GROUP_CATEGORY_LABEL, hashShareToken, type GroupShareSnapshot } from "@/lib/group/types";

const PENDING_KEY = "btln_group_perspective_pending";

const GroupShareView = () => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [snapshot, setSnapshot] = useState<GroupShareSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "gone">("loading");
  const [selected, setSelected] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setState("gone");
        return;
      }
      try {
        const hash = await hashShareToken(token);
        const { data } = await supabase.rpc("resolve_group_share", { p_token_hash: hash });
        if (cancelled) return;
        if (!data) {
          setState("gone");
          return;
        }
        setSnapshot(data as unknown as GroupShareSnapshot);
        setState("ok");
        // Token never leaves the URL bar — nothing token-related is sent here.
        track("group_share_visited", {});
      } catch {
        if (!cancelled) setState("gone");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Intent survives the sign-in round trip: the chosen role is restored, never
  // the link token or anything about the group.
  useEffect(() => {
    if (state !== "ok" || selected !== null) return;
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (raw === null) return;
    const idx = Number(raw);
    if (Number.isInteger(idx) && snapshot && idx < snapshot.role_cards.length) setSelected(idx);
  }, [state, selected, snapshot]);

  const choose = (i: number) => {
    setSelected(i);
    setSaved(false);
    setSaveError(null);
    sessionStorage.setItem(PENDING_KEY, String(i));
    track("group_perspective_selected", {});
  };

  const savePerspective = useCallback(async () => {
    if (selected === null || !snapshot || !token) return;
    setSaving(true);
    setSaveError(null);
    const hash = await hashShareToken(token);
    const { data, error } = await supabase.rpc("save_recipient_perspective", {
      p_token_hash: hash,
      p_participant_index: selected,
      p_participant_label: snapshot.role_cards[selected]?.label ?? null,
    });
    setSaving(false);
    if (error) {
      setSaveError("We couldn't save that just now. Please try again.");
      return;
    }
    if (!data) {
      // Fails closed: the owner turned the link off while this page was open.
      setState("gone");
      setSnapshot(null);
      return;
    }
    setSaved(true);
    sessionStorage.removeItem(PENDING_KEY);
    track("group_perspective_saved", {});
  }, [selected, snapshot, token]);

  const card = selected !== null && snapshot ? snapshot.role_cards[selected] : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        {/* No chat text, names or quotes in metadata, and never indexed. */}
        <title>A shared Group Read | BetweenTheLines</title>
        <meta name="description" content="Someone shared how their group chat works." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-12 sm:px-8">
        {state === "loading" && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening…
          </p>
        )}

        {state === "gone" && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h1 className="text-[22px] font-medium">This link isn't active</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              It was either turned off by whoever made it, or the link is wrong.
            </p>
            <Link
              to="/group"
              onClick={() => track("group_share_conversion", {})}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
            >
              Read your own group chat <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {state === "ok" && snapshot && (
          <>
            <p className="text-sm text-muted-foreground">
              Group Read · {GROUP_CATEGORY_LABEL[snapshot.category] ?? "Group"}
            </p>
            <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-tight sm:text-[36px]">
              {snapshot.title}
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
              {snapshot.subtitle}
            </p>

            <ul className="mt-8 space-y-3">
              {snapshot.role_cards.map((c, i) => (
                <li key={i} className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="text-[18px] font-medium">
                    {c.label} · <span className="text-muted-foreground">{c.role}</span>
                  </h2>
                  {c.headline && <p className="mt-2 text-[16px]">{c.headline}</p>}
                  {c.why && <p className="mt-2 text-[15px] text-muted-foreground">{c.why}</p>}
                  {c.evidence && (
                    <p className="mt-2 border-l-2 border-border pl-3 text-[14px] italic text-muted-foreground">
                      {c.evidence}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => choose(i)}
                    aria-pressed={selected === i}
                    className={`mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${
                      selected === i
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {selected === i && <Check className="h-4 w-4" />}
                    {selected === i ? "This is your pick" : "Is this you? See your perspective"}
                  </button>
                </li>
              ))}
            </ul>

            {card && (
              <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-6">
                <h2 className="text-[19px] font-medium">Your perspective as {card.label}</h2>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Picking a role here is self-reported. It isn't identity verification, it doesn't
                  claim that name for you, and it gives you nothing from the private report — only
                  what the person who shared it chose to release.
                </p>
                {card.headline && <p className="mt-4 text-[16px]">{card.headline}</p>}
                {card.why && (
                  <p className="mt-2 text-[15px] text-muted-foreground">{card.why}</p>
                )}
                {snapshot.strengths.length > 0 && (
                  <p className="mt-4 text-[15px]">
                    <span className="font-medium">One strength of this group: </span>
                    {snapshot.strengths[0]}
                  </p>
                )}
                {snapshot.suggestions && snapshot.suggestions.length > 0 ? (
                  <p className="mt-2 text-[15px]">
                    <span className="font-medium">One next step: </span>
                    {snapshot.suggestions[0]}
                  </p>
                ) : (
                  <p className="mt-2 text-[14px] text-muted-foreground">
                    No next step was released with this link.
                  </p>
                )}

                <div className="mt-5">
                  {saved ? (
                    <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
                      <Check className="h-4 w-4" /> Saved to your account. Only you can see it.
                    </p>
                  ) : authLoading ? null : user ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void savePerspective()}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[14px] font-medium text-background disabled:opacity-40"
                      >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save this perspective
                      </button>
                      {saveError && (
                        <p className="mt-2 text-[14px] text-destructive">{saveError}</p>
                      )}
                    </>
                  ) : (
                    <Link
                      to={`/auth?return_to=${encodeURIComponent(location.pathname)}`}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-[14px] font-medium hover:bg-muted/50"
                    >
                      Sign in to save this perspective <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            )}

            {snapshot.strengths.length > 0 && (
              <div className="mt-6 rounded-2xl border border-border bg-card p-5">
                <h2 className="text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">
                  What this group does well
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[16px]">
                  {snapshot.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 text-center">
              <p className="text-[18px] font-medium">Is one of these you?</p>
              <p className="mt-2 text-[15px] text-muted-foreground">
                This page only shows what the person who made it chose to release. To see a read of
                your own, start one from your side of the chat.
              </p>
              <Link
                to="/group"
                onClick={() => track("group_share_conversion", {})}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
              >
                Read my group chat <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="mt-6 text-center text-[13px] text-muted-foreground">
              {snapshot.participant_count} people
              {snapshot.message_count ? ` · ${snapshot.message_count} messages` : ""} · no
              conversation text is shared on this page
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default GroupShareView;

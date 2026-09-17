import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Flame, Loader2 } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { track } from "@/lib/analytics";

type Source = {
  type: "analysis" | "group_read";
  id: string;
  label: string;
  sub: string;
  eligible: boolean;
  reason?: string;
};

const RoastStart = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preType = params.get("source");
  const preId = params.get("id");

  const loadSources = useCallback(async () => {
    // Ownership is decided server-side: signed-in account, or this device's
    // own guest reads. Nothing here reveals anyone else's reports.
    const { data } = await supabase.rpc("list_roastable_sources", {
      p_session_id: getSessionId(),
    });

    const rows = (data ?? []) as {
      source_type: "analysis" | "group_read";
      source_id: string;
      label: string;
      category: string;
      is_unlocked: boolean;
      created_at: string;
    }[];

    setSources(
      rows.map((r) => ({
        type: r.source_type,
        id: r.source_id,
        label: r.label,
        sub: `${r.source_type === "group_read" ? "Group Read" : "Deep Read"} · ${new Date(
          r.created_at,
        ).toLocaleDateString()}`,
        eligible: r.is_unlocked === true,
        reason: r.is_unlocked ? undefined : "Unlock the full report first",
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    if (preType && preId) setPicked(`${preType}:${preId}`);
  }, [preType, preId]);

  const start = async () => {
    if (!picked || !consent) return;
    const [sourceType, sourceId] = picked.split(":");
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("roast-us", {
      body: {
        source_type: sourceType,
        source_id: sourceId,
        session_id: getSessionId(),
        tone: "playful",
        consent: true,
      },
    });
    setBusy(false);
    if (fnError || !data?.roast_id) {
      setError(
        (data as { error?: string } | null)?.error ??
          "We couldn't start that roast. Please try again.",
      );
      return;
    }
    track("roast_started", { source_type: sourceType });
    navigate(`/roast/${data.roast_id}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Roast Us — a playful read of your chat | BetweenTheLines</title>
        <meta
          name="description"
          content="Turn a finished read of your chat into a warm, funny roast — with one genuinely useful takeaway at the end."
        />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-12 sm:px-8">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Flame className="h-4 w-4" /> Roast Us
        </p>
        <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-tight sm:text-[38px]">
          The funny version of a read you already have
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
          Pick one of your finished reads and we'll turn it into a roast — affectionate, never
          cruel, with an “Okay, but seriously…” at the end. We don't look at your chat again; we
          only use the read you already got.
        </p>

        <section className="mt-10">
          <h2 className="text-[20px] font-medium">Choose a read</h2>

          {loading && (
            <p className="mt-4 flex items-center gap-2 text-[15px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Looking for your finished reads…
            </p>
          )}

          {!loading && sources.length === 0 && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-5">
              <p className="text-[15px]">
                You don't have a finished read yet. Start one and come back — the Roast Us button
                shows up on the report itself.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-[15px] font-medium text-background"
                >
                  Start a Deep Read <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/group"
                  className="rounded-full border border-border px-5 py-3 text-[15px] font-medium hover:bg-muted/50"
                >
                  Start a Group Read
                </Link>
              </div>
            </div>
          )}

          {!loading && sources.length > 0 && (
            <ul className="mt-4 space-y-2">
              {sources.map((s) => {
                const value = `${s.type}:${s.id}`;
                return (
                  <li key={value}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                        picked === value ? "border-foreground bg-muted/40" : "border-border bg-card"
                      } ${s.eligible ? "" : "opacity-60"}`}
                    >
                      <input
                        type="radio"
                        name="source"
                        className="mt-1 h-4 w-4"
                        value={value}
                        checked={picked === value}
                        disabled={!s.eligible}
                        onChange={() => setPicked(value)}
                      />
                      <span className="min-w-0">
                        <span className="block text-[16px] font-medium">{s.label}</span>
                        <span className="block text-[13px] text-muted-foreground">{s.sub}</span>
                        {!s.eligible && (
                          <span className="mt-1 block text-[13px] text-muted-foreground">
                            {s.reason}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <label className="flex items-start gap-3 text-[15px]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I'm choosing the playful version. The jokes are about how people text, not about who
              they are — and the other people in this chat haven't agreed to anything, so it's on me
              to decide whether they'd find it funny.
            </span>
          </label>
        </section>

        {error && <p className="mt-4 text-[15px] text-destructive">{error}</p>}

        <button
          type="button"
          onClick={start}
          disabled={!picked || !consent || busy}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
          Roast us
        </button>
      </main>
    </div>
  );
};

export default RoastStart;

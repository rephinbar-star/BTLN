import { forwardRef } from "react";
import type { WrappedStats } from "@/lib/wrapped/stats";

export type WrappedCardVariant = "story" | "square";

const SIZES: Record<WrappedCardVariant, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

const CREAM = "hsl(40, 22%, 95%)";
const INK = "hsl(0, 0%, 7%)";
const MUTED = "hsl(0, 0%, 42%)";
const BRAND = "hsl(17, 52%, 50%)";
const OLIVE = "hsl(84, 20%, 30%)";

const pct = (n: number) => `${Math.round(n * 100)}%`;

const fmtMinutes = (m: number | null) => {
  if (m === null) return "—";
  if (m < 1) return "under a minute";
  if (m < 60) return `${Math.round(m)} min`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(h < 10 ? 1 : 0)} h`;
  return `${(h / 24).toFixed(1)} days`;
};

const prettyDay = (key: string) => {
  const d = new Date(`${key}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

/**
 * Fixed-size export card. Rendered at exactly 1080x1920 or 1080x1080 so the
 * downloaded PNG is the full card with nothing clipped.
 */
export const WrappedCard = forwardRef<
  HTMLDivElement,
  { stats: WrappedStats; names: Record<string, string>; variant: WrappedCardVariant }
>(function WrappedCard({ stats, names, variant }, ref) {
  const { w, h } = SIZES[variant];
  const story = variant === "story";
  const top = stats.participants.slice(0, 4);
  const leadStarter = stats.initiation.byParticipant[0];
  const fastest = [...stats.replies]
    .filter((r) => r.medianReplyMinutes !== null)
    .sort((a, b) => (a.medianReplyMinutes as number) - (b.medianReplyMinutes as number))[0];

  const label = (id: string) => names[id] ?? id;

  const Stat = ({ value, caption }: { value: string; caption: string }) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: story ? 72 : 60, fontWeight: 600, color: INK, lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: story ? 28 : 24, color: MUTED, marginTop: 8 }}>{caption}</div>
    </div>
  );

  return (
    <div
      ref={ref}
      style={{
        width: w,
        height: h,
        background: CREAM,
        color: INK,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        padding: story ? 88 : 72,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      <div>
        <div style={{ fontSize: story ? 30 : 26, letterSpacing: 2, color: BRAND, textTransform: "uppercase" }}>
          Relationship Wrapped
        </div>
        <div style={{ fontSize: story ? 96 : 76, fontWeight: 600, marginTop: 16, lineHeight: 1.05 }}>
          {stats.period.label}
        </div>
        <div style={{ fontSize: story ? 30 : 26, color: MUTED, marginTop: 14 }}>
          {stats.totals.firstTs && stats.totals.lastTs
            ? `${prettyDay(stats.totals.firstTs.slice(0, 10))} – ${prettyDay(stats.totals.lastTs.slice(0, 10))}`
            : "No dated messages in this selection"}
        </div>

        <div style={{ display: "flex", gap: 32, marginTop: story ? 72 : 48 }}>
          <Stat value={stats.totals.messages.toLocaleString()} caption="messages imported" />
          <Stat value={stats.totals.activeDays.toLocaleString()} caption="days with messages" />
          <Stat value={stats.initiation.sessions.toLocaleString()} caption="conversations started" />
        </div>

        <div style={{ marginTop: story ? 72 : 48 }}>
          <div style={{ fontSize: story ? 32 : 28, fontWeight: 600, marginBottom: 20 }}>Who said how much</div>
          {top.map((p) => (
            <div key={p.id} style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: story ? 30 : 26,
                  marginBottom: 8,
                }}
              >
                <span>{label(p.id)}</span>
                <span style={{ color: MUTED }}>
                  {p.messages.toLocaleString()} · {pct(p.share)}
                </span>
              </div>
              <div style={{ height: 14, background: "hsl(0, 0%, 88%)", borderRadius: 999 }}>
                <div
                  style={{
                    width: `${Math.max(2, Math.round(p.share * 100))}%`,
                    height: 14,
                    background: OLIVE,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {story && (
          <div style={{ display: "flex", gap: 32, marginTop: 64 }}>
            <Stat
              value={leadStarter ? pct(leadStarter.share) : "—"}
              caption={leadStarter ? `of conversations started by ${label(leadStarter.id)}` : "initiation unavailable"}
            />
            <Stat
              value={fastest ? fmtMinutes(fastest.medianReplyMinutes) : "—"}
              caption={fastest ? `${label(fastest.id)}'s typical reply gap` : "reply gaps unavailable"}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 40, marginTop: story ? 64 : 44, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: story ? 28 : 24, color: MUTED, marginBottom: 10 }}>Busiest day</div>
            <div style={{ fontSize: story ? 40 : 32, fontWeight: 600 }}>
              {stats.busiest.day ? prettyDay(stats.busiest.day.key) : "—"}
            </div>
            <div style={{ fontSize: story ? 26 : 22, color: MUTED, marginTop: 6 }}>
              {stats.busiest.day ? `${stats.busiest.day.count} messages` : "no dated messages"}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: story ? 28 : 24, color: MUTED, marginBottom: 10 }}>Most used</div>
            <div style={{ fontSize: story ? 56 : 44, letterSpacing: 6 }}>
              {stats.emojis.length ? stats.emojis.map((e) => e.emoji).join(" ") : "—"}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: story ? 24 : 20, color: MUTED, lineHeight: 1.45 }}>
          Counted from the messages imported for this period only
          {stats.totals.withoutTime > 0
            ? `. ${stats.totals.withoutTime} message${stats.totals.withoutTime === 1 ? "" : "s"} had no readable time and are left out of time-based figures`
            : ""}
          . Times follow the export&apos;s own clock.
        </div>
        <div style={{ fontSize: story ? 28 : 24, color: BRAND, marginTop: 18, fontWeight: 600 }}>
          betweenthelines.app
        </div>
      </div>
    </div>
  );
});

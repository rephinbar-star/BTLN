import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Build-time prerender for the 39 public pair-type pages.
 *
 * Social crawlers (Facebook, LinkedIn, Slack, WhatsApp, X) do not run
 * JavaScript, so react-helmet-async tags never reach them. This plugin writes
 * a static `dist/types/<category>/<slug>/index.html` for every combination,
 * with title / description / canonical / Open Graph tags already in the
 * initial HTML. The body is unchanged, so React hydrates as usual.
 *
 * Data is read from the public `couple_types` table with the publishable key.
 * If the fetch fails the build still succeeds — the SPA fallback keeps working.
 */

const SLUG_BY_ID: Record<number, string> = {
  1: "power-couple",
  2: "steady-anchors",
  3: "quiet-loyalists",
  4: "deep-feelers",
  5: "independent-duo",
  6: "magnet-and-moon",
  7: "support-system",
  8: "builders",
  9: "duet",
  10: "brave-duo",
  11: "solo-climbers",
  12: "quiet-companions",
  13: "fire-pair",
};

const CATEGORIES = [
  { segment: "romantic", key: "romantic", label: "Romantic" },
  { segment: "friends", key: "friend", label: "Friends" },
  { segment: "family", key: "family", label: "Family" },
] as const;

const SITE = "https://betweenthelines.app";

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const displayName = (s: string) => s.replace(/^The\s+/i, "").trim();

type Row = Record<string, string | number | null>;

export const prerenderPairTypes = (): Plugin => ({
  name: "prerender-pair-types",
  apply: "build",
  async closeBundle() {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const outDir = path.resolve(process.cwd(), "dist");
    const templatePath = path.join(outDir, "index.html");
    if (!url || !key || !fs.existsSync(templatePath)) {
      console.warn("[prerender] skipped — missing backend env or dist/index.html");
      return;
    }

    let rows: Row[] = [];
    try {
      const res = await fetch(
        `${url}/rest/v1/couple_types?select=*&order=id`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      rows = (await res.json()) as Row[];
      if (!Array.isArray(rows)) throw new Error("unexpected response");
    } catch (e) {
      console.warn("[prerender] skipped — could not load pair types:", e);
      return;
    }

    const template = fs.readFileSync(templatePath, "utf8");
    let written = 0;

    for (const row of rows) {
      const id = Number(row.id);
      const slug = SLUG_BY_ID[id];
      if (!slug) continue;
      for (const cat of CATEGORIES) {
        const name = displayName(String(row[`${cat.key}_name`] ?? ""));
        const tagline = String(row[`${cat.key}_tagline`] ?? "");
        const image = String(row[`image_url_${cat.key}`] ?? "");
        const canonical = `${SITE}/types/${cat.segment}/${slug}`;
        const title = `${name} — ${cat.label} pair type | BetweenTheLines™`;
        const description = `${tagline} What ${name} looks like in ${cat.label.toLowerCase()} messages — its superpower, where it gets stuck, and what helps.`;

        const head = [
          `<title>${escapeHtml(title)}</title>`,
          `<meta name="description" content="${escapeHtml(description)}" />`,
          `<link rel="canonical" href="${canonical}" />`,
          `<meta property="og:type" content="article" />`,
          `<meta property="og:title" content="${escapeHtml(`${name} — ${cat.label} | BetweenTheLines™`)}" />`,
          `<meta property="og:description" content="${escapeHtml(tagline)}" />`,
          `<meta property="og:url" content="${canonical}" />`,
          image ? `<meta property="og:image" content="${image}" />` : "",
          `<meta name="twitter:card" content="summary_large_image" />`,
          `<meta name="twitter:title" content="${escapeHtml(`${name} — ${cat.label} | BetweenTheLines™`)}" />`,
          `<meta name="twitter:description" content="${escapeHtml(tagline)}" />`,
          image ? `<meta name="twitter:image" content="${image}" />` : "",
        ]
          .filter(Boolean)
          .join("\n    ");

        const html = template
          .replace(/<title>[\s\S]*?<\/title>/i, "")
          .replace(/<meta\s+name="description"[^>]*>/i, "")
          .replace(/<link\s+rel="canonical"[^>]*>/i, "")
          .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
          .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
          .replace("</head>", `    ${head}\n  </head>`);

        const dir = path.join(outDir, "types", cat.segment, slug);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "index.html"), html);
        written += 1;
      }
    }
    console.log(`[prerender] wrote ${written} pair-type pages`);
  },
});

import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const PAGES = [
  { path: "/pricing", title: "Pricing | BetweenTheLines™", description: "Compare a $4.99 single report with $9.99 monthly and $49.99 annual full-report access for Deep Reads and Group Reads." },
  { path: "/sample", title: "Conversation Analysis Sample | BetweenTheLines™", description: "Explore a clearly labeled fictional BetweenTheLines report for romantic, friend, or family conversations." },
  { path: "/guides/mixed-signal-texts", title: "How to Read Mixed-Signal Texts | BetweenTheLines™", description: "A careful guide to reading mixed-signal texts without inventing intent, plus a path to Quick Take." },
  { path: "/guides/group-chat-communication", title: "Understand Group Chat Communication | BetweenTheLines™", description: "Learn what a group-chat read can support, from participation balance to unanswered questions and repair attempts." },
  {
    path: "/about",
    title: "About BetweenTheLines™ — AI Relationship Analysis",
    description: "Learn how BetweenTheLines™ uses AI to analyze your messages and uncover your relationship dynamics.",
  },
  {
    path: "/guides/whatsapp",
    title: "How to Export WhatsApp Chats — BetweenTheLines™",
    description: "Learn how to export your WhatsApp chat history for AI relationship analysis.",
  },
  {
    path: "/guides/imessage",
    title: "How to Export iMessage Chats — BetweenTheLines™",
    description: "Learn how to export your iMessage chat history for AI relationship analysis.",
  },
  {
    path: "/guides/instagram",
    title: "How to Export Instagram Messages — BetweenTheLines™",
    description: "Learn how to export your Instagram messages for AI relationship analysis.",
  },
  {
    path: "/trust",
    title: "Trust & Safety — BetweenTheLines™",
    description: "How we handle your data and ensure your privacy.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy — BetweenTheLines™",
    description: "Our privacy policy and how we protect your information.",
  },
  {
    path: "/terms",
    title: "Terms of Service — BetweenTheLines™",
    description: "Our terms of service and usage guidelines.",
  },
];

const SITE = "https://betweenthelines.app";

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const prerenderStaticPages = (): Plugin => ({
  name: "prerender-static-pages",
  apply: "build",
  async closeBundle() {
    const outDir = path.resolve(process.cwd(), "dist");
    const templatePath = path.join(outDir, "index.html");
    if (!fs.existsSync(templatePath)) return;

    const template = fs.readFileSync(templatePath, "utf8");
    let written = 0;

    for (const page of PAGES) {
      const canonical = `${SITE}${page.path}`;
      const head = [
        `<title>${escapeHtml(page.title)}</title>`,
        `<meta name="description" content="${escapeHtml(page.description)}" />`,
        `<link rel="canonical" href="${canonical}" />`,
        `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
        `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
        `<meta property="og:url" content="${canonical}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
      ].join("\n    ");

      const html = template
        .replace(/<title>[\s\S]*?<\/title>/i, "")
        .replace(/<meta\s+name="description"[^>]*>/i, "")
        .replace(/<link\s+rel="canonical"[^>]*>/i, "")
        .replace("</head>", `    ${head}\n  </head>`);

      const dir = path.join(outDir, page.path);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), html);
      written += 1;
    }
    console.log(`[prerender] wrote ${written} static pages`);
  },
});

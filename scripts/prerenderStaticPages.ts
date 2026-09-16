import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const PAGES = [
  { path: "/pricing", title: "Pricing | BetweenTheLines™", description: "Compare a $4.99 single report with $9.99 monthly and $49.99 annual full-report access for Deep Reads and Group Reads." },
  { path: "/sample", title: "Conversation Analysis Sample | BetweenTheLines™", description: "Explore a clearly labeled fictional BetweenTheLines report for romantic, friend, or family conversations." },
  { path: "/guides/mixed-signal-texts", title: "How to Read Mixed-Signal Texts | BetweenTheLines™", description: "A careful guide to reading mixed-signal texts without inventing intent, plus a path to Quick Take." },
  { path: "/guides/group-chat-communication", title: "Understand Group Chat Communication | BetweenTheLines™", description: "Learn what a group-chat read can support, from participation balance to unanswered questions and repair attempts." },
  { path: "/compare/chatgpt-vs-betweenthelines", title: "BetweenTheLines vs ChatGPT for Reading a Chat | BetweenTheLines\u2122", description: "An evidence-based comparison of using ChatGPT directly versus BetweenTheLines for analysing a WhatsApp or iMessage conversation, with sources and dates." },
  { path: "/compare/rizz-vs-betweenthelines", title: "RIZZ vs BetweenTheLines: Replies or a Read? | BetweenTheLines\u2122", description: "RIZZ suggests what to send next; BetweenTheLines explains the pattern across a conversation. A sourced comparison of the two workflows." },
  { path: "/compare/whatbrandonthinks-vs-betweenthelines", title: "What Brandon Thinks vs BetweenTheLines | BetweenTheLines\u2122", description: "A sourced comparison of What Brandon Thinks and BetweenTheLines: a persona-voiced verdict on a chat export versus a structured, evidence-marked read." },

  {
    path: "/about",
    title: "About BetweenTheLines™ | Private Chat Analysis",
    description: "How BetweenTheLines turns selected conversations into structured, private communication reports without claiming certainty about people.",
  },
  {
    path: "/guides/whatsapp",
    title: "Import a WhatsApp Chat | BetweenTheLines™",
    description: "Export a WhatsApp chat without media, preview participants and dates, then route two-person chats to Deep Read or groups to Group Read.",
  },
  {
    path: "/guides/imessage",
    title: "Import iMessage TXT or CSV | BetweenTheLines™",
    description: "Use a supported plain-text or CSV iMessage export; binary chat.db files, executables, PDFs, and encrypted archives are rejected.",
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

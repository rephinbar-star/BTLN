#!/usr/bin/env bun
/**
 * DNS Propagation Checker
 * Queries multiple public DNS resolvers for TXT records on a domain.
 *
 * Usage:
 *   bun run scripts/check-dns-propagation.ts
 *   bun run scripts/check-dns-propagation.ts --domain=example.com --txt="google-site-verification=abc"
 */

import { parseArgs } from "util";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    domain: { type: "string", default: "betweenthelines.app" },
    txt: {
      type: "string",
      default:
        "google-site-verification=zZaBZqZHoh6lZRSWRBazxShKgHCHKPFTWVTNWgp8Jd0",
    },
  },
  strict: false,
  allowPositionals: false,
});

const TARGET_DOMAIN = values.domain as string;
const TARGET_TXT = values.txt as string;

interface DoHResolver {
  name: string;
  url: string;
  headers?: Record<string, string>;
}

const RESOLVERS: DoHResolver[] = [
  {
    name: "Google DNS",
    url: `https://dns.google/resolve?name=${encodeURIComponent(
      TARGET_DOMAIN
    )}&type=TXT`,
  },
  {
    name: "Cloudflare DNS",
    url: `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
      TARGET_DOMAIN
    )}&type=TXT`,
    headers: { accept: "application/dns-json" },
  },
  {
    name: "Quad9 DNS",
    url: `https://dns.quad9.net:5053/dns-query?name=${encodeURIComponent(
      TARGET_DOMAIN
    )}&type=TXT`,
    headers: { accept: "application/dns-json" },
  },
  {
    name: "NextDNS",
    url: `https://dns.nextdns.io/resolve?name=${encodeURIComponent(
      TARGET_DOMAIN
    )}&type=TXT`,
  },
];

interface DoHAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DoHResponse {
  Status: number;
  Answer?: DoHAnswer[];
  Authority?: DoHAnswer[];
  Comment?: string;
}

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

function color(name: keyof typeof COLORS, text: string): string {
  return `${COLORS[name]}${text}${COLORS.reset}`;
}

function stripQuotes(txt: string): string {
  // DNS TXT data is returned with outer quotes by some resolvers
  return txt.replace(/^"/, "").replace(/"$/, "");
}

async function queryResolver(resolver: DoHResolver): Promise<{
  found: boolean;
  records: string[];
  error?: string;
}> {
  try {
    const res = await fetch(resolver.url, {
      headers: resolver.headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return {
        found: false,
        records: [],
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    }

    const json: DoHResponse = await res.json();

    if (json.Status !== 0 && json.Status !== 3) {
      // 3 = NXDOMAIN, which means domain exists but no TXT
      return {
        found: false,
        records: [],
        error: `DNS status code: ${json.Status}`,
      };
    }

    const answers = json.Answer ?? [];
    const txtRecords = answers
      .filter((a) => a.type === 16)
      .map((a) => stripQuotes(a.data));

    const found = txtRecords.some((r) =>
      r.toLowerCase().includes(TARGET_TXT.toLowerCase())
    );

    return { found, records: txtRecords };
  } catch (err: any) {
    return {
      found: false,
      records: [],
      error: err?.message || String(err),
    };
  }
}

async function main() {
  console.log(
    color("bold", "\n=== DNS Propagation Checker ===\n")
  );
  console.log(`Domain: ${color("cyan", TARGET_DOMAIN)}`);
  console.log(`Looking for TXT: ${color("yellow", TARGET_TXT)}\n`);

  let propagatedCount = 0;

  for (const resolver of RESOLVERS) {
    process.stdout.write(`Checking ${color("cyan", resolver.name)} ... `);
    const result = await queryResolver(resolver);

    if (result.error) {
      console.log(color("red", `ERROR`));
      console.log(`  ${color("dim", result.error)}`);
      continue;
    }

    if (result.found) {
      console.log(color("green", "FOUND"));
      propagatedCount++;
    } else {
      console.log(color("red", "NOT FOUND"));
    }

    if (result.records.length > 0) {
      for (const record of result.records) {
        const highlighted =
          record.toLowerCase().includes(TARGET_TXT.toLowerCase())
            ? color("green", record)
            : record;
        console.log(`  ${color("dim", "•")} ${highlighted}`);
      }
    } else {
      console.log(`  ${color("dim", "(no TXT records returned)")}`);
    }
  }

  console.log("");
  console.log(
    color(
      "bold",
      `Propagated: ${propagatedCount} / ${RESOLVERS.length} resolvers`
    )
  );

  if (propagatedCount === RESOLVERS.length) {
    console.log(color("green", "\nAll resolvers see the record. Propagation complete!"));
  } else if (propagatedCount > 0) {
    console.log(
      color(
        "yellow",
        "\nPartial propagation. Some resolvers see it, others don't yet."
      )
    );
    console.log(
      color("dim", "DNS changes can take up to 72 hours to fully propagate.")
    );
  } else {
    console.log(
      color(
        "red",
        "\nRecord not found on any resolver. It may not be set yet or hasn't propagated."
      )
    );
    console.log(
      color("dim", "If you just added it, wait a few minutes and check again.")
    );
  }

  console.log("");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

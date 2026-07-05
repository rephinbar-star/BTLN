import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// Build a realistic 100-message paste alternating between two speakers.
function build100MessagePaste(): string {
  const lines: string[] = [];
  const samples = [
    "hey, how was your day?",
    "pretty good, just tired from work",
    "same here, want to grab dinner tonight?",
    "yeah sounds great, where were you thinking?",
    "that new place downtown maybe",
    "perfect, 7pm?",
    "works for me",
    "cool, see you then ❤️",
    "can't wait",
    "me neither",
  ];
  for (let i = 0; i < 100; i++) {
    const who = i % 2 === 0 ? "Alex" : "Sam";
    const hh = String(9 + Math.floor(i / 10)).padStart(2, "0");
    const mm = String((i * 3) % 60).padStart(2, "0");
    lines.push(`[05/07/26, ${hh}:${mm}:00] ${who}: ${samples[i % samples.length]}`);
  }
  return lines.join("\n");
}

Deno.test(
  "analyze-conversation: 100-message paste completes end-to-end without 500",
  async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const session_id = crypto.randomUUID();
    const raw_text = build100MessagePaste();

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/analyze-conversation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          session_id,
          input_method: "paste",
          raw_text,
          context_data: {
            name1: "Alex",
            name2: "Sam",
            relationship_type: "romantic",
            relationship_stage: "dating",
            duration: "6 months",
            goal: "integration test",
            free_text: "",
          },
        }),
      },
    );

    const bodyText = await res.text();
    assert(
      res.status !== 500,
      `Edge function returned 500: ${bodyText}`,
    );
    assertEquals(res.status, 202, `Expected 202, got ${res.status}: ${bodyText}`);

    const { analysis_id } = JSON.parse(bodyText);
    assert(analysis_id, "Expected analysis_id in response");

    // Poll analyses row until it reaches a terminal state (complete/failed) or times out.
    const deadline = Date.now() + 120_000; // 2 minutes
    let status = "pending";
    let errorMessage: string | null = null;
    let messageCount: number | null = null;

    while (Date.now() < deadline) {
      const { data: rows, error } = await supabase.rpc(
        "get_analysis_for_session",
        { p_id: analysis_id, p_session_id: session_id },
      );
      if (error) throw error;
      const data = Array.isArray(rows) ? rows[0] : rows;
      if (data) {
        status = (data as { status: string }).status;
        errorMessage = (data as { error_message: string | null }).error_message;
        messageCount = (data as { message_count: number | null }).message_count;
        if (status === "complete" || status === "failed") break;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    assertEquals(
      status,
      "complete",
      `Analysis did not complete. status=${status} error=${errorMessage}`,
    );
    assert(
      messageCount !== null && messageCount > 0,
      `Expected message_count > 0, got ${messageCount}`,
    );
  },
);

// Deno wrapper: resolves a server-issued test-run token and runs the live
// pipeline handler inside a metered context (see testRunCore.ts).
//
// Header: x-btln-test-run: <run uuid>.<secret>
//  - The run is created only by the operator-authorised prompt-improvement
//    function, bound to one synthetic account, one function and a version.
//  - The caller must be that exact account (verified from its own bearer token).
//  - Any invalid token is refused outright; there is no unmetered fallback.
// Synthetic accounts (@btln-test.dev) without a token run in a blocked context:
// the handler works, but any model call is refused.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { dbBudget, openRouterProvider } from "./promptBudget.ts";
import { sha256 } from "./modeEval.ts";
import { testRunStore, type TestCtx } from "./testRunCore.ts";

const TEST_EMAIL = /@btln-test\.dev$/i;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-btln-test-run",
};
const deny = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const withTestRun = (fnName: string, handler: (req: Request) => Promise<Response>) => async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handler(req);
  const header = req.headers.get("x-btln-test-run");
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  // Only real user tokens resolve; anon/publishable keys yield no user.
  const user = token && token.split(".").length === 3 ? (await admin.auth.getUser(token)).data?.user ?? null : null;

  if (!header) {
    if (user && TEST_EMAIL.test(user.email ?? "")) {
      const ctx: TestCtx = { kind: "blocked", reason: "synthetic_account_requires_metered_test_run" };
      return testRunStore.run(ctx, () => handler(req));
    }
    return handler(req);
  }
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{32,128})$/.exec(header);
  if (!m || !user) return deny(403, "Invalid test run.");
  if (!TEST_EMAIL.test(user.email ?? "")) return deny(403, "Test runs are for synthetic accounts only.");
  const { data, error } = await admin.rpc("claim_prompt_test_run", { p_id: m[1], p_secret_hash: await sha256(m[2]), p_user: user.id, p_function: fnName });
  if (error || !data?.ok) return deny(403, `Test run refused: ${data?.reason ?? "unavailable"}.`);
  const apiKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const ctx: TestCtx = {
    kind: "metered",
    runId: String(data.id),
    scope: "improvement",
    deps: { ...dbBudget(admin), provider: openRouterProvider(apiKey, "BetweenTheLines metered test run") },
    stage: "unlabelled",
    maxCalls: Number(data.max_calls) || 12,
    candidate: data.variant === "candidate" && data.candidate_addendum
      ? { mode: String(data.mode), addendum: String(data.candidate_addendum), baselineTextHash: String(data.baseline_text_hash) }
      : null,
    timeoutMs: 150_000,
    shared: { calls: [], seen: new Map(), candidateUsed: [] },
    annotate: async (id, stage) => { await admin.from("prompt_spend_ledger").update({ stage, test_run_id: String(data.id) }).eq("id", id); },
  };
  return testRunStore.run(ctx, () => handler(req));
};

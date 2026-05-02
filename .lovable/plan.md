## Update model slugs + system prompt for Sonnet 4.6

The Edge Function (`supabase/functions/analyze-conversation/index.ts`) is already complete and reads `model_string`, `vision_model_string`, and `prompt_text` from the active `prompt_versions` row. It sends no `reasoning` parameter and caps output at 8000 tokens — both already match your spec. No function code changes needed.

This round is purely a database update.

### Step 1: Schema migration — column defaults

Update the column defaults on `prompt_versions` so any future row inserts pick up the new slugs:

```sql
ALTER TABLE public.prompt_versions
  ALTER COLUMN model_string SET DEFAULT 'anthropic/claude-sonnet-4.6',
  ALTER COLUMN vision_model_string SET DEFAULT 'google/gemini-3-flash-preview';
```

### Step 2: Data update — seeded row

Update the existing `version_number = 1` row (data operation, runs via the insert/update tool — not a migration):

```sql
UPDATE public.prompt_versions
   SET model_string        = 'anthropic/claude-sonnet-4.6',
       vision_model_string = 'google/gemini-3-flash-preview'
 WHERE version_number = 1;
```

### Step 3: System prompt — needs your text

Your earlier message gave only the **closing line** of the system prompt:

> "The output is JSON only. No preamble, no explanation, no markdown outside the JSON. Begin your response with { and end with }."

I don't have the full prompt body (the long Compatibility Scorecard prompt v1.0 you tested in Claude.ai). I will not invent it.

Two options for how to handle this:

**Option A (recommended) — you paste the full prompt here in your next message.**
I'll then run a single `UPDATE` setting `prompt_text` to the full text, with the closing JSON-only line appended verbatim if it isn't already the last paragraph. Cleanest, single-source-of-truth in the DB.

**Option B — you paste it directly in the database UI.**
Go to Cloud → Database → Tables → `prompt_versions` → row where `version_number = 1` → edit `prompt_text`. Make sure the closing line above is the final paragraph. I'll skip step 3 entirely.

Either way, the closing line you quoted will be the final paragraph of the prompt — that's the Sonnet 4.6 compatibility guard against reasoning preamble breaking JSON parsing.

### Step 4: Confirm Edge Function is unchanged (no edits)

Re-verify (read-only) that `supabase/functions/analyze-conversation/index.ts`:
- Sends no `reasoning` field in either OpenRouter call. ✅
- Keeps `MAX_OUTPUT_TOKENS = 8000` cost guard. ✅
- Reads `model_string` / `vision_model_string` / `prompt_text` from the active `prompt_versions` row at call time. ✅

### Step 5: Hand off function URL for curl test

After steps 1–3 are done, the function is live at:

```
https://ukycdbvasmeuralmvvcm.supabase.co/functions/v1/analyze-conversation
```

I'll provide a ready-to-paste curl command (text-paste path, since that's faster to validate than vision) and wait for your test result before any frontend wiring.

### What I will NOT do this round

- No frontend wiring, no `/processing/{id}`, no `/report/{analysis_id}`, no feedback modal, no share buttons, no `/error` route. All of that waits for your green light from the curl test.

### Decision needed before I start

Pick **A** (paste the full system prompt in your next message — I'll handle the DB update) or **B** (you'll paste it via the database UI yourself — I'll skip that step).

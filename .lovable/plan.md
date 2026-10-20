# Add a fourth reply tone: "Set Boundary"

## What changes
- Quick Take replies go from three to four: Direct, Warm, Playful, **Set Boundary**.
- "Set Boundary" is a calm, respectful reply that states a limit or a need. It never guilt-trips, threatens or uses ultimatums.
- Who sees it:
  - Your first free Quick Take.
  - A $4.99 single Quick Take session.
  - The $6.99/month Quick Take plan, which includes Interactive Mode.
- Interactive Mode also returns all four tones, including when the person asks for another version.
- No change for safety cases: when there are signs of abuse, the app still shows no suggested replies.
- No change to prices, payments or who can unlock what.

## Example
Sam: "guess you were busy again 🙄"
- Direct: "I was, and I should've told you. Can we talk tonight?"
- Warm: "Sorry, I hate leaving you hanging. I'm here now."
- Playful: "Guilty 🙈 Let me make it up to you, tonight?"
- Set Boundary: "I get that it's frustrating. I'd rather talk it through than trade digs, though. Can we do that?"

## Steps
1. Save a new version of the Quick Take instructions that asks for four labelled replies and defines "Set Boundary". The current version stays available for rollback.
2. Update the shared Interactive Mode instructions from "exactly 3" replies to "exactly 4", using the same four tones.
3. Update the result page and Interactive Mode panel so four replies display cleanly on phone and desktop, with copy buttons and labels.
4. Make the reply checks accept four replies. Older saved reports with three replies still display as they are.
5. Check: run the focused tests, the typecheck and the build, and review the layout at 375px and on desktop using a made-up example. No paid or real-customer actions. Nothing is published.

## Technical details
- Quick Take prompt is the active `prompt_versions` row of kind `decode`; insert a new version (data change) and switch `active`, keeping the previous row for rollback.
- `INTERACTIVE_SYSTEM` in `supabase/functions/_shared/modePrompts.ts` (shared by the live function and the evaluator); redeploy `interactive-mode`.
- `src/pages/DecodeResult.tsx` and `InteractiveModePanel.tsx`: grid layout for 4 options. Locked-state gating stays server-side and unchanged.
- `_shared/modeEval.ts` and its tests: accept 4 `reply_options` with the new tone label.

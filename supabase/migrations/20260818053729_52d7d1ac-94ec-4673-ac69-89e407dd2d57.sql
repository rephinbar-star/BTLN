UPDATE public.prompt_versions
SET prompt_text = replace(
  replace(prompt_text, '# Quick Decode — System Prompt v1.2', '# Quick Decode — System Prompt v1.3'),
  '## OUTPUT — return ONLY this JSON, nothing else',
  '7. HANDLE TRUNCATED / FRAGMENT MESSAGES BY POSITION. If a message looks cut off or is an ambiguous fragment you can''t confidently complete (e.g. "I''m a b"), do NOT guess its intended meaning and build a conclusion on that guess. Instead:

   - If the fragment is NOT the last message (there are replies after it), treat it as a likely typo or crop artifact and disregard it — read the exchange from the surrounding messages, and if it mattered, note "one message looks cut off, so I''m reading around it."

   - If the fragment IS the last message in the exchange, do not decode its content; instead read the fact that they left you on an incomplete or terse note as the signal itself, and set confidence no higher than "medium."

   Either way, avoid catastrophizing predictions (e.g. "they''ll ghost you") from a single ambiguous message — only make a call that strong when the pattern across multiple messages clearly supports it.

## OUTPUT — return ONLY this JSON, nothing else')
WHERE id = '1e2f71d1-0955-496a-bb79-6272278d6d1f';
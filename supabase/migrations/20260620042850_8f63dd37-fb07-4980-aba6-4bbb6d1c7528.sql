UPDATE public.prompt_versions
SET prompt_text = replace(
  prompt_text,
  'Confidence level (low/medium/high) based on message volume and clarity of patterns.',
  'Confidence level (low/medium/high) for each attachment profile, based on the volume of that person''s messages and pattern clarity.'
)
WHERE active = true;

UPDATE public.prompt_versions
SET prompt_text = replace(
  prompt_text,
  '## SCORING METHODOLOGY',
$$## OVERALL ANALYSIS CONFIDENCE

Set `meta.analysis_confidence` using these explicit thresholds based on `messages_analyzed` (the total messages successfully extracted, regardless of input method — paste, chat file, or screenshot):

- `messages_analyzed` < 25 → "low"
- 25–59 → "medium"
- 60+ → "high"

Only downgrade from these defaults if the conversation is extremely one-sided (e.g. >90% from a single sender) or the content is mostly logistics/links with no relational signal. Do NOT downgrade because patterns are mixed, ambiguous, or the relationship looks complicated — those are normal and should be reflected in individual fields (nulls, hedged language) rather than a low overall confidence rating. A 60+ message conversation should almost always be "high".

## SCORING METHODOLOGY$$
)
WHERE active = true;
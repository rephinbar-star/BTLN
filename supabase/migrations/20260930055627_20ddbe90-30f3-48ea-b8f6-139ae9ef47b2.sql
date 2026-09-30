CREATE OR REPLACE FUNCTION public.claim_prompt_test_run(p_id uuid, p_secret_hash text, p_user uuid, p_function text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r public.prompt_test_runs; used int; launches int; allowed int; probe_call boolean;
begin
  select * into r from public.prompt_test_runs where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_run'); end if;
  if r.secret_hash <> p_secret_hash then return jsonb_build_object('ok', false, 'reason', 'bad_secret'); end if;
  probe_call := p_function = 'advice-review' and r.recovery_probe is not null and r.mode = 'deep_read_full' and r.variant = 'baseline';
  -- The recovery probe resubmits after the original report was finalized (still inside expiry, one launch, call cap).
  if r.status <> 'active' and not (probe_call and r.status = 'finalized') then return jsonb_build_object('ok', false, 'reason', 'run_closed'); end if;
  if r.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if r.target_user_id <> p_user then return jsonb_build_object('ok', false, 'reason', 'wrong_user'); end if;
  if r.function_name <> p_function
     and not (p_function = 'extract-chat-input')
     and not (r.mode = 'interactive' and p_function = 'decode-conversation')
     and not probe_call then
    return jsonb_build_object('ok', false, 'reason', 'wrong_function');
  end if;
  allowed := case when r.mode = 'interactive' and p_function = 'interactive-mode' then 2 else 1 end;
  select count(*) into launches from public.prompt_test_run_claims where run_id = r.id and function_name = p_function;
  if launches >= allowed then return jsonb_build_object('ok', false, 'reason', 'replayed'); end if;
  select count(*) into used from public.prompt_spend_ledger where job_id = r.id;
  if used >= r.max_calls then return jsonb_build_object('ok', false, 'reason', 'run_call_limit'); end if;
  insert into public.prompt_test_run_claims (run_id, function_name, seq) values (r.id, p_function, launches + 1);
  return jsonb_build_object('ok', true, 'id', r.id, 'mode', r.mode, 'variant', r.variant, 'candidate_id', r.candidate_id,
    'candidate_addendum', r.candidate_addendum, 'baseline_text_hash', r.baseline_text_hash, 'max_calls', r.max_calls - used,
    'eval_scope', r.eval_scope, 'recovery_probe', r.recovery_probe);
end $function$;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"};
const json = (status:number, body:unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type":"application/json" } });
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const b64url=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const hash=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,"0")).join("");
const alias=(i:number)=>`Participant ${String.fromCharCode(65+i)}`;
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return json(405,{error:"Method not allowed"});
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
 let body:Record<string,unknown>; try{body=await req.json();}catch{return json(400,{error:"Invalid request."});}
 const action=String(body.action??"");
 if(action==="resolve"){
   const token=String(body.token??""); if(token.length<32)return json(404,{error:"Link not found."});
    const tokenHash=await hash(token); const {data:link}=await db.from("group_roast_share_links").select("id,snapshot_json,visit_count").eq("token_hash",tokenHash).is("revoked_at",null).maybeSingle();
   if(!link)return json(404,{error:"Link not found."}); await db.from("group_roast_share_links").update({visit_count:(Number((link as any).visit_count??0)+1)}).eq("id",link.id); return json(200,{snapshot:link.snapshot_json});
 }
 const auth=req.headers.get("Authorization")??""; const token=auth.toLowerCase().startsWith("bearer ")?auth.slice(7).trim():""; const {data:a}=token?await db.auth.getUser(token):{data:{user:null}}; const uid=a.user?.id;
 if(!uid)return json(401,{error:"Sign in to open a private Group Roast."});
 const id=String(body.group_roast_id??""); if(!UUID_RE.test(id))return json(400,{error:"Missing Group Roast."});
 const {data:g}=await db.from("group_roasts").select("*").eq("id",id).eq("user_id",uid).maybeSingle(); if(!g)return json(404,{error:"That Group Roast isn't yours."});
 const {data:sub}=await db.from("user_subscriptions").select("tier,status,current_period_end").eq("user_id",uid);
 const plan=(sub??[]).some((s:any)=>["monthly","annual"].includes(s.tier)&&["active","trialing","past_due"].includes(s.status)&&(!s.current_period_end||Date.parse(s.current_period_end)>Date.now()));
 const {data:unlock}=await db.from("group_roast_unlocks").select("id").eq("group_roast_id",id).eq("user_id",uid).maybeSingle(); const unlocked=plan||!!unlock;
  if(action==="get")return json(200,{roast:{id:g.id,status:g.status,participant_count:g.participant_count,message_count:g.message_count,selected_period:g.selected_period,participant_labels:g.participant_labels,stats:g.stats_json,coverage:g.coverage_json,preview:g.preview_json,result:unlocked?g.result_json:null,observations:unlocked?g.observations_json:[],is_unlocked:unlocked,safety_blocked:g.safety_blocked,error_message:g.error_message,created_at:g.created_at}});
  if(action==="adapt_journey"){
    const sourceId=String(body.journey_source_id??""); if(!UUID_RE.test(sourceId))return json(400,{error:"Missing Journey source."});
    const {data:source}=await db.from("journey_sources").select("id,user_id,relationship_id,source_kind,source_id,subject_participant,observed_period_start,observed_period_end,consent_at").eq("id",sourceId).eq("user_id",uid).eq("source_kind","group_roast").eq("source_id",id).maybeSingle();
    if(!source||!source.subject_participant)return json(403,{error:"Explicit Journey source and self-participant confirmation are required."});
    const allowed=(Array.isArray(g.observations_json)?g.observations_json:[]).filter((o:any)=>o&&typeof o.statement==="string"&&o.statement.trim()).slice(0,40);
    await db.from("journey_observations").delete().eq("journey_source_id",source.id).eq("user_id",uid);
    if(allowed.length){const rows=allowed.map((o:any)=>({user_id:uid,relationship_id:source.relationship_id,journey_source_id:source.id,subject_kind:String(o.participant_id??"")===String(source.subject_participant)?"user_behavior":"other_behavior",subject_label:o.participant_id?String(o.participant_id):null,observation_type:"grounded_group_behavior",statement:String(o.statement).slice(0,2000),evidence_refs:Array.isArray(o.evidence_refs)?o.evidence_refs.slice(0,8):[],confidence:["low","medium","high"].includes(String(o.confidence))?o.confidence:"low",alternatives:[],observed_period_start:source.observed_period_start,observed_period_end:source.observed_period_end}));const {error}=await db.from("journey_observations").insert(rows);if(error)return json(500,{error:"Could not prepare Journey observations."});}
    return json(200,{adapted:true,observation_count:allowed.length});
  }
 if(action==="revoke"){await db.from("group_roast_share_links").update({revoked_at:new Date().toISOString()}).eq("group_roast_id",id).is("revoked_at",null);return json(200,{revoked:true});}
 if(action!=="share")return json(400,{error:"Unknown action."});
 if(!unlocked)return json(403,{error:"Unlock the full Group Roast before sharing."}); if(g.status!=="complete"||!g.result_json||g.safety_blocked)return json(400,{error:"This Group Roast cannot be shared."});
 const includeNames=body.include_names===true, includeQuotes=body.include_quotes===true; const result=g.result_json as any; const participants=Array.isArray(result.participants)?result.participants:[];
 const escaped=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); const scrub=(value:unknown)=>{let out=String(value??"");if(!includeNames)participants.forEach((p:any,i:number)=>{const n=String(p.display_name??"").trim();if(n.length>1)out=out.replace(new RegExp(`\\b${escaped(n)}\\b('s)?`,"gi"),(_m,poss)=>poss?`${alias(i)}'s`:alias(i));});return out;};
 const roles=(Array.isArray(result.participant_roles)?result.participant_roles:[]).map((r:any,i:number)=>({label:includeNames?String(participants.find((p:any)=>p.id===r.participant_id)?.display_name??alias(i)):alias(i),role:scrub(r.role).slice(0,60),headline:scrub(r.headline).slice(0,180),observed_behavior:scrub(r.observed_behavior).slice(0,260),...(includeQuotes&&r.evidence?{evidence:scrub(r.evidence).slice(0,180)}:{})}));
 const snapshot={v:1,title:scrub(result.group_headline).slice(0,120),personality:scrub(result.group_personality).slice(0,360),participant_count:g.participant_count,message_count:g.message_count,include_names:includeNames,include_quotes:includeQuotes,roles,dynamics:(Array.isArray(result.interaction_dynamics)?result.interaction_dynamics:[]).slice(0,4).map((x:unknown)=>scrub(x).slice(0,220)),seriously:scrub(result.seriously).slice(0,500),created_at:new Date().toISOString()};
 await db.from("group_roast_share_links").update({revoked_at:new Date().toISOString()}).eq("group_roast_id",id).is("revoked_at",null); const raw=b64url(crypto.getRandomValues(new Uint8Array(32))); const {error}=await db.from("group_roast_share_links").insert({group_roast_id:id,token_hash:await hash(raw),snapshot_json:snapshot,include_names:includeNames,include_quotes:includeQuotes}); if(error)return json(500,{error:"Could not create the share link."}); return json(200,{token:raw});
});

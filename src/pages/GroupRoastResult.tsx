import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import * as htmlToImage from "html-to-image";
import { AlertTriangle, Check, Copy, Download, Link2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Button } from "@/components/ui/button";
import { GroupRoastShareCard } from "@/components/groupRoast/GroupRoastShareCard";
import { PrimeOffer } from "@/components/prime/PrimeOffer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import type { GroupRoastOwnerView, GroupRoastRole } from "@/lib/groupRoast/types";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { FeedbackControl } from "@/components/feedback/FeedbackControl";

const POLL_MS = 2500;
const TIMEOUT_MS = 240000;

export default function GroupRoastResult() {
  const { groupRoastId } = useParams<{ groupRoastId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [roast, setRoast] = useState<GroupRoastOwnerView | null>(null);
  const [missing, setMissing] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [includeNames, setIncludeNames] = useState(false);
  const [includeQuotes, setIncludeQuotes] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportRole, setExportRole] = useState<{ label: string; role: GroupRoastRole } | null>(null);
  const [exportFormat, setExportFormat] = useState<"square" | "story">("square");
  const exportRef = useRef<HTMLDivElement>(null);
  const started = useRef(Date.now());
  const { openCheckout, closeCheckout, checkoutElement, isOpen } = useStripeCheckout();

  const load = useCallback(async () => {
    if (!groupRoastId || !user) return;
    const { data, error } = await supabase.functions.invoke("group-roast-data", { body: { action: "get", group_roast_id: groupRoastId } });
    if (error || !data?.roast) { setMissing(true); return; }
    setRoast(data.roast as GroupRoastOwnerView);
    setMissing(false);
  }, [groupRoastId, user]);

  useEffect(() => {
    if (!user) return;
    void load();
    const timer = window.setInterval(() => {
      if (roast?.status === "complete" || roast?.status === "failed" || roast?.status === "blocked") return window.clearInterval(timer);
      if (Date.now() - started.current > TIMEOUT_MS) { setTimedOut(true); return window.clearInterval(timer); }
      void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, roast?.status, user]);

  const share = async () => {
    if (!groupRoastId) return;
    setSharing(true); setShareError(null);
    const { data, error } = await supabase.functions.invoke("group-roast-data", { body: { action: "share", group_roast_id: groupRoastId, include_names: includeNames, include_quotes: includeQuotes } });
    setSharing(false);
    if (error || !data?.token) return setShareError("We couldn't create that private snapshot.");
    setShareToken(String(data.token));
  };
  const revoke = async () => {
    if (!groupRoastId) return;
    setSharing(true);
    await supabase.functions.invoke("group-roast-data", { body: { action: "revoke", group_roast_id: groupRoastId } });
    setSharing(false); setShareToken(null);
  };
  const shareUrl = shareToken ? `${window.location.origin}/gr/${shareToken}` : null;
  const saveRole = async (role: GroupRoastRole, label: string, format: "square" | "story") => {
    setExportRole({ role, label }); setExportFormat(format);
    await new Promise((r) => window.setTimeout(r, 50));
    const node = exportRef.current; if (!node) return;
    const url = await htmlToImage.toPng(node, { pixelRatio: 1, cacheBust: true });
    const a = document.createElement("a"); a.href = url; a.download = `group-roast-${format}.png`; a.click();
    setExportRole(null);
  };

  if (authLoading) return <Shell><Loader2 className="h-5 w-5 animate-spin" /></Shell>;
  if (!user) return <Shell><h1 className="text-2xl font-semibold">Your Group Roast is private</h1><p className="mt-3 text-muted-foreground">Sign in with the account that created it.</p><Button asChild className="mt-5 rounded-full"><Link to={`/auth?return_to=${encodeURIComponent(`/group-roast/${groupRoastId ?? ""}`)}`}>Sign in</Link></Button></Shell>;
  if (missing) return <Shell><h1 className="text-2xl font-semibold">We can't open that Group Roast</h1><p className="mt-3 text-muted-foreground">It either is not yours or no longer exists.</p><Button asChild className="mt-5 rounded-full"><Link to="/group-roast">Roast a group</Link></Button></Shell>;
  if (!roast) return <Shell><p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening your private result…</p></Shell>;
  if (roast.status === "failed" || timedOut) return <Shell><h1 className="flex items-center gap-2 text-2xl font-semibold"><AlertTriangle className="text-destructive" /> That didn't finish</h1><p className="mt-3 text-muted-foreground">{roast.error_message ?? "It took longer than expected."} Raw messages were already deleted.</p><Button asChild className="mt-5 rounded-full"><Link to="/group-roast"><RefreshCw /> Start again</Link></Button></Shell>;
  if (roast.status === "blocked") return <Shell><h1 className="flex items-center gap-2 text-2xl font-semibold"><ShieldAlert className="text-destructive" /> This chat needs care, not a roast</h1><p className="mt-3 text-muted-foreground">{roast.result?.seriously ?? roast.preview?.taste ?? "The safety check switched the jokes off."}</p><Button asChild variant="outline" className="mt-5 rounded-full"><Link to="/group-roast">Choose another chat</Link></Button></Shell>;
  if (roast.status !== "complete" || !roast.preview) return <Shell><h1 className="flex items-center gap-2 text-2xl font-semibold"><Loader2 className="animate-spin" /> Building the roast</h1><p className="mt-3 text-muted-foreground">Reading the selected history in bounded passes. Keep this page open; your raw messages are not stored.</p></Shell>;

  const result = roast.result;
  const names = new Map(roast.participant_labels.map((p) => [p.id, p.display_name]));
  return <div className="min-h-screen bg-btln-paper text-foreground">
    <Helmet><title>Your Group Roast | BetweenTheLines</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <Header />
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-8 sm:px-8">
      <p className="text-sm text-muted-foreground">Group Roast · {roast.participant_count} people · {roast.message_count.toLocaleString()} messages</p>
      <h1 className="mt-3 text-[32px] font-semibold leading-tight sm:text-[40px]">{roast.preview.headline}</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">{roast.preview.taste}</p>
      {roast.result?.coverage && <p className="mt-3 text-xs text-muted-foreground">AI coverage: {Number(roast.result.coverage.messages_read_by_ai ?? 0).toLocaleString()} of {Number(roast.result.coverage.messages_supplied ?? roast.message_count).toLocaleString()} selected messages · {roast.result.coverage.full_history_read ? "full selected history read" : "some history slices could not be read"}</p>}

      {!roast.is_unlocked && <section className="mt-8 rounded-lg border border-btln-line bg-card p-5">
        {roast.preview.top_role && <div className="rounded-lg bg-btln-peach/40 p-4"><p className="text-sm text-muted-foreground">One role from the cast</p><h2 className="mt-1 text-xl font-semibold">{roast.preview.top_role.role}</h2><p className="mt-2 text-sm text-muted-foreground">{roast.preview.top_role.headline}</p></div>}
        <h2 className="mt-6 text-xl font-semibold">Unlock the full roast</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Get every participant's evidence-grounded role, interaction dynamics, standout moments and the constructive “But seriously…” takeaway. The full result stays server-protected until entitlement is confirmed.</p>
        <PrimeOffer className="mt-4" returnTo={`/group-roast/${roast.id}`} />
        {isOpen ? <div className="mt-5">{checkoutElement}<Button variant="ghost" className="mt-2 w-full" onClick={closeCheckout}>Cancel</Button></div> : <Button className="mt-5 w-full rounded-full" onClick={() => openCheckout({ priceId: "BTLN_report_unlock", reportKind: "group_roast", groupRoastId: roast.id, userId: user.id, customerEmail: user.email ?? undefined, returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&group_roast_id=${roast.id}` })}>Unlock this Group Roast — $4.99</Button>}
      </section>}

      {roast.is_unlocked && result && <>
        <section className="mt-10"><h2 className="text-xl font-semibold">The cast</h2><ul className="mt-4 space-y-3">{(result.participant_roles ?? []).map((role, i) => { const label=names.get(role.participant_id) ?? `Participant ${i+1}`; return <li key={role.participant_id} className="rounded-lg border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><h3 className="mt-1 text-xl font-semibold">{role.role}</h3><p className="mt-2">{role.headline}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{role.observed_behavior}</p>{role.evidence&&<blockquote className="mt-3 border-l-2 border-btln-leaf pl-3 text-sm italic text-muted-foreground">“{role.evidence}”</blockquote>}<p className="mt-3 text-xs text-muted-foreground">Evidence confidence: {role.confidence}</p><div className="mt-3 flex gap-2"><Button variant="outline" size="sm" onClick={()=>void saveRole(role,label,"square")}><Download /> 1:1</Button><Button variant="outline" size="sm" onClick={()=>void saveRole(role,label,"story")}><Download /> 9:16</Button></div></li>;})}</ul></section>
        {(result.interaction_dynamics?.length ?? 0)>0&&<section className="mt-10"><h2 className="text-xl font-semibold">How the chaos circulates</h2><ul className="mt-4 space-y-3">{result.interaction_dynamics?.map((x,i)=><li key={i} className="rounded-lg border border-border bg-card p-5">{x}</li>)}</ul></section>}
        {(result.standout_moments?.length ?? 0)>0&&<section className="mt-10"><h2 className="text-xl font-semibold">Standout moments</h2><ul className="mt-4 space-y-3">{result.standout_moments?.map((x,i)=><li key={i} className="rounded-lg border border-border bg-card p-5"><p>{x.moment}</p>{x.evidence&&<p className="mt-2 text-sm italic text-muted-foreground">“{x.evidence}”</p>}</li>)}</ul></section>}
        <section className="mt-10 rounded-lg border border-btln-line bg-btln-mint/40 p-5"><h2 className="text-xl font-semibold">But seriously…</h2><p className="mt-3 leading-relaxed">{result.seriously}</p></section>
        <section className="mt-10 rounded-lg border border-border bg-card p-5"><h2 className="text-xl font-semibold">Share a privacy-safe snapshot</h2><p className="mt-2 text-sm text-muted-foreground">Names and quotes are hidden by default. The transcript and private source never appear in the public snapshot. Selecting a name does not verify that person's identity.</p><label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={includeNames} onChange={(e)=>setIncludeNames(e.target.checked)} /> Show names</label><label className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={includeQuotes} onChange={(e)=>setIncludeQuotes(e.target.checked)} /> Include evidence quotes</label><div className="mt-4 flex flex-wrap gap-2"><Button onClick={()=>void share()} disabled={sharing} className="rounded-full"><Link2 /> {shareToken?"Replace link":"Create link"}</Button>{shareToken&&<Button variant="outline" onClick={()=>void revoke()} className="rounded-full">Turn off</Button>}</div>{shareUrl&&<div className="mt-4 flex items-center gap-2 rounded-lg border p-3"><code className="min-w-0 flex-1 truncate text-xs">{shareUrl}</code><Button size="sm" variant="outline" onClick={async()=>{await navigator.clipboard.writeText(shareUrl);setCopied(true);window.setTimeout(()=>setCopied(false),1200);}}>{copied?<Check/>:<Copy/>}{copied?"Copied":"Copy"}</Button>{typeof navigator!=="undefined"&&"share" in navigator&&<Button size="sm" variant="outline" onClick={()=>void navigator.share({title:"Our Group Roast",url:shareUrl})}>Share</Button>}</div>}{shareError&&<p className="mt-3 text-sm text-destructive">{shareError}</p>}</section>
        <section className="mt-10 grid gap-3 sm:grid-cols-2"><Link to="/group-roast" className="rounded-lg border border-border bg-card p-5 font-semibold">Roast another group →</Link><Link to="/group" className="rounded-lg border border-border bg-card p-5 font-semibold">Try the serious Group Read →</Link></section>
        <PrimeOffer className="mt-4" returnTo={`/group-roast/${roast.id}`} />
        <div className="mt-10 flex justify-end"><FeedbackControl label="this roast" target={{ targetKind: "humor" }} /></div>
        <p className="mt-8 text-center text-xs text-muted-foreground">Raw messages were deleted after generation. Only the structured result, measured coverage and grounded observations remain private to your account.</p>
      </>}
    </main>
    {exportRole&&<div className="pointer-events-none fixed -left-[10000px] top-0"><GroupRoastShareCard ref={exportRef} format={exportFormat} label={includeNames?exportRole.label:"Participant"} role={includeQuotes?exportRole.role:{...exportRole.role,evidence:null}} /></div>}
  </div>;
}

function Shell({children}:{children:React.ReactNode}) { return <div className="min-h-screen bg-btln-paper text-foreground"><Helmet><title>Your Group Roast | BetweenTheLines</title><meta name="robots" content="noindex,nofollow" /></Helmet><Header/><main className="mx-auto max-w-2xl px-5 pb-20 pt-12 sm:px-8">{children}</main></div>; }

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type AuthOAuth = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauthApi = (): AuthOAuth => (supabase.auth as unknown as { oauth: AuthOAuth }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?return_to=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="text-xl font-semibold mb-2">Authorization error</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </main>
    );
  }
  if (!details) {
    return <main className="mx-auto max-w-md p-8">Loading…</main>;
  }
  const clientName = details.client?.name ?? "an app";
  return (
    <main className="mx-auto max-w-md p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Connect {clientName}</h1>
        <p className="text-sm text-muted-foreground">
          Allow {clientName} to access your BetweenTheLines account and read your saved analyses on your behalf.
        </p>
      </div>
      <div className="flex gap-3">
        <Button disabled={busy} onClick={() => decide(true)}>Approve</Button>
        <Button disabled={busy} variant="outline" onClick={() => decide(false)}>Deny</Button>
      </div>
    </main>
  );
}
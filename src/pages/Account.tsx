import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { getStripeEnvironment } from "@/lib/stripe";
import type { AnalysisResult } from "@/lib/analysis-types";

type AnalysisRow = {
  id: string;
  created_at: string;
  status: string;
  result_json: AnalysisResult | null;
};

type SubscriptionRow = {
  id: string;
  tier: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  updated_at?: string | null;
};

type MembershipStatus =
  | { kind: "none" }
  | { kind: "single"; unlockedAt?: string | null }
  | { kind: "monthly"; sub: SubscriptionRow }
  | { kind: "annual"; sub: SubscriptionRow };

type WebhookEventRow = {
  id: string;
  created_at: string;
  event_type: string;
  status: string;
  checkout_session_id: string | null;
  amount_cents: number | null;
  changes: Record<string, unknown> | null;
  error_message: string | null;
};

const Account = () => {
  const navigate = useNavigate();
  const { user, session, signOut } = useAuth();
  const [rows, setRows] = useState<AnalysisRow[] | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [deletingReport, setDeletingReport] = useState(false);
  const [membership, setMembership] = useState<MembershipStatus>({ kind: "none" });
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [unlockCount, setUnlockCount] = useState<number>(0);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventRow[] | null>(null);
  const [showEvents, setShowEvents] = useState(false);
  const [confirmCancelSub, setConfirmCancelSub] = useState(false);
  const [cancelingSub, setCancelingSub] = useState(false);

  const isPasswordUser = !!user?.identities?.some((i) => i.provider === "email");
  const verified = !!user?.email_confirmed_at;

  // Always land at the top of the page on mount (e.g. after post-signup redirect).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("analyses")
        .select("id, created_at, status, result_json")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as AnalysisRow[]);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setDisplayName(data?.display_name ?? "");
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("id, tier, status, current_period_end, cancel_at_period_end, stripe_subscription_id, updated_at")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: unlocks } = await supabase
        .from("one_time_unlocks")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const unlockList = (unlocks ?? []) as Array<{ id: string; created_at: string }>;
      setUnlockCount(unlockList.length);
      if (sub) {
        const tier = (sub.tier || "").toLowerCase();
        if (tier.includes("annual") || tier.includes("year")) {
          setMembership({ kind: "annual", sub: sub as SubscriptionRow });
        } else {
          setMembership({ kind: "monthly", sub: sub as SubscriptionRow });
        }
        setLastSync(sub.updated_at ?? null);
      } else if (unlockList.length > 0) {
        setMembership({ kind: "single", unlockedAt: unlockList[0].created_at });
        setLastSync(unlockList[0].created_at);
      } else {
        setMembership({ kind: "none" });
        setLastSync(null);
      }
      const { data: events } = await supabase
        .from("webhook_events")
        .select("id, created_at, event_type, status, checkout_session_id, amount_cents, changes, error_message")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setWebhookEvents((events ?? []) as WebhookEventRow[]);
      if (events && events.length > 0) {
        const latest = events[0].created_at;
        if (!sub || new Date(latest) > new Date(sub.updated_at ?? 0)) {
          setLastSync(latest);
        }
      }
    })();
  }, [user]);

  const resendVerification = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
    if (error) toast.error(error.message);
    else toast.success("Verification email sent.");
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setNameBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("user_id", user.id);
    setNameBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Name saved.");
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    setDeletingReport(true);
    const { error } = await supabase.from("analyses").delete().eq("id", reportToDelete);
    setDeletingReport(false);
    if (error) {
      toast.error("Couldn't delete report.");
      return;
    }
    setRows((prev) => (prev ? prev.filter((r) => r.id !== reportToDelete) : prev));
    setReportToDelete(null);
    toast.success("Report deleted.");
  };

  const handleCancelSubscription = async () => {
    setCancelingSub(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { environment: getStripeEnvironment() },
      });
      if (error || (data as any)?.error) {
        toast.error("Couldn't cancel subscription. Please try again.");
        setCancelingSub(false);
        return;
      }
      setMembership((m) =>
        m.kind === "monthly" || m.kind === "annual"
          ? { ...m, sub: { ...m.sub, cancel_at_period_end: true } }
          : m,
      );
      setConfirmCancelSub(false);
      toast.success("Subscription will end at the end of your billing period.");
    } catch {
      toast.error("Couldn't cancel subscription. Please try again.");
    } finally {
      setCancelingSub(false);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated.");
      setNewPassword("");
      setShowPassword(false);
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) {
        toast.error("Couldn't delete account. Please try again.");
        setDeleting(false);
        return;
      }
      await supabase.auth.signOut();
      navigate("/", { replace: true });
      toast.success("Your account has been deleted.");
    } catch {
      toast.error("Couldn't delete account. Please try again.");
      setDeleting(false);
    }
  };

  const membershipLabel = (() => {
    switch (membership.kind) {
      case "single":
        return "Paid for single report";
      case "monthly":
        return "Subscribed $9.99/month";
      case "annual":
        return "Subscribed $49.99/Year";
      default:
        return "Free";
    }
  })();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-12 sm:px-8">
        {!verified && !bannerDismissed && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-start gap-2 text-[14px]">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                Verify your email to secure your account — we sent a link to{" "}
                <span className="font-medium">{user?.email}</span>.{" "}
                <button onClick={resendVerification} className="underline hover:text-foreground">
                  Resend verification email
                </button>
              </p>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-medium tracking-tight">My account</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {user?.email}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  verified
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {verified ? "verified" : "unverified"}
              </span>
            </p>
          </div>
        </div>

        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[18px] font-medium tracking-tight">Subscription status</h2>
            <span className="text-[11px] text-muted-foreground">
              Last sync: {lastSync ? new Date(lastSync).toLocaleString() : "—"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Active plan</div>
              <div className="mt-1 text-sm font-medium">{membershipLabel}</div>
              {(membership.kind === "monthly" || membership.kind === "annual") && membership.sub.current_period_end && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {membership.sub.cancel_at_period_end ? "Ends" : "Renews"}{" "}
                  {new Date(membership.sub.current_period_end).toLocaleDateString()}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">One-time unlocks</div>
              <div className="mt-1 text-sm font-medium">
                {unlockCount === 0 ? "None" : `${unlockCount} report${unlockCount === 1 ? "" : "s"} unlocked`}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Webhook events</div>
              <div className="mt-1 text-sm font-medium">
                {webhookEvents === null ? "…" : `${webhookEvents.length} recent`}
              </div>
              <button
                type="button"
                onClick={() => setShowEvents((s) => !s)}
                className="mt-1 text-xs text-muted-foreground underline hover:text-foreground"
              >
                {showEvents ? "Hide" : "View"} audit log
              </button>
            </div>
          </div>
          {showEvents && (
            <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-background">
              {webhookEvents && webhookEvents.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Event</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">DB changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhookEvents.map((ev) => (
                      <tr key={ev.id} className="border-t border-border">
                        <td className="px-3 py-2 align-top text-muted-foreground">
                          {new Date(ev.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 align-top font-mono">{ev.event_type}</td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={
                              ev.status === "error"
                                ? "text-destructive"
                                : ev.status === "skipped" || ev.status === "ignored"
                                  ? "text-muted-foreground"
                                  : "text-emerald-700"
                            }
                          >
                            {ev.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          {ev.amount_cents != null ? `$${(ev.amount_cents / 100).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <code className="text-[10px]">
                            {ev.error_message
                              ? ev.error_message
                              : ev.changes && Object.keys(ev.changes).length > 0
                                ? JSON.stringify(ev.changes)
                                : "—"}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No webhook events yet.
                </div>
              )}
            </div>
          )}
        </section>

        <form onSubmit={saveName} className="flex flex-col gap-2">
          <Label htmlFor="display-name">Name (optional)</Label>
          <div className="flex gap-2">
            <Input
              id="display-name"
              type="text"
              value={displayName}
              maxLength={80}
              placeholder="Your name"
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Button type="submit" disabled={nameBusy} className="rounded-full">
              {nameBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>

        <section className="flex flex-col gap-3">
          <h2 className="text-[18px] font-medium tracking-tight">Membership</h2>
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">{membershipLabel}</div>
              {(membership.kind === "monthly" || membership.kind === "annual") &&
                membership.sub.current_period_end && (
                  <div className="text-xs text-muted-foreground">
                    {membership.sub.cancel_at_period_end ? "Ends" : "Renews"} on{" "}
                    {new Date(membership.sub.current_period_end).toLocaleDateString()}
                  </div>
                )}
            </div>
            {(membership.kind === "monthly" || membership.kind === "annual") &&
              !membership.sub.cancel_at_period_end && (
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setConfirmCancelSub(true)}
                >
                  Cancel subscription
                </Button>
              )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-medium tracking-tight">Past reports</h2>
        {rows === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No reports yet. Run an analysis from the homepage to get started.
            </p>
            <Link
              to="/#input-section"
              className="mt-4 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background"
            >
              Run your first analysis
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => {
              const score = r.result_json?.headline?.score;
              const tier = r.result_json?.headline?.tier_label;
              return (
                <li key={r.id}>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40">
                    <Link to={`/report/${r.id}`} className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {tier ?? (r.status === "complete" ? "Report" : r.status)}
                        {typeof score === "number" && (
                          <span className="ml-2 text-muted-foreground">{score}/100</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </Link>
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/report/${r.id}`}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        View →
                      </Link>
                      <button
                        type="button"
                        aria-label="Delete report"
                        onClick={() => setReportToDelete(r.id)}
                        className="ml-2 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        </section>

        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 className="text-[18px] font-medium tracking-tight">Account</h2>

          {isPasswordUser && (
            showPassword ? (
              <form onSubmit={updatePassword} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  minLength={8}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={pwBusy} className="rounded-full">
                    {pwBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update password
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowPassword(false);
                      setNewPassword("");
                    }}
                    className="rounded-full"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div>
                <Button variant="outline" onClick={() => setShowPassword(true)} className="rounded-full">
                  Change password
                </Button>
              </div>
            )
          )}

          <div>
            <Button
              variant="outline"
              onClick={() => signOut().then(() => navigate("/"))}
              className="rounded-full"
            >
              Sign out
            </Button>
          </div>

          <button
            onClick={() => setConfirmDelete(true)}
            className="self-start text-xs text-muted-foreground underline hover:text-foreground"
          >
            Delete my account
          </button>
        </section>
      </main>
      <Footer />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account. Your past reports will become anonymous
              but won't be deleted. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!reportToDelete}
        onOpenChange={(open) => !open && setReportToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the report from your account. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingReport}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteReport();
              }}
              disabled={deletingReport}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingReport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancelSub} onOpenChange={setConfirmCancelSub}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll keep access until the end of your current billing period, then your
              subscription will end. You won't be charged again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelingSub}>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleCancelSubscription();
              }}
              disabled={cancelingSub}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelingSub && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Account;
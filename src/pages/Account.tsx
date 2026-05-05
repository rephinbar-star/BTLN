import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail, X } from "lucide-react";
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
import type { AnalysisResult } from "@/lib/analysis-types";

type AnalysisRow = {
  id: string;
  created_at: string;
  status: string;
  result_json: AnalysisResult | null;
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

  const isPasswordUser = !!user?.identities?.some((i) => i.provider === "email");
  const verified = !!user?.email_confirmed_at;

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

  const resendVerification = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
    if (error) toast.error(error.message);
    else toast.success("Verification email sent.");
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
                  <Link
                    to={`/report/${r.id}`}
                    className="flex items-center justify-between rounded-xl border border-border p-4 transition-colors hover:bg-muted/40"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {tier ?? (r.status === "complete" ? "Report" : r.status)}
                        {typeof score === "number" && (
                          <span className="ml-2 text-muted-foreground">{score}/100</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">View →</span>
                  </Link>
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
    </div>
  );
};

export default Account;
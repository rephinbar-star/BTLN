import { useEffect, useState } from "react";
import { Loader2, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { claimPendingAnalysis, getSessionId } from "@/lib/session";

type Tab = "magic" | "password";
type View = "form" | "sent";

type Props = {
  open: boolean;
  onClose: () => void;
  returnTo: string; // absolute path on this site
};

export const SaveReportModal = ({ open, onClose, returnTo }: Props) => {
  const [tab, setTab] = useState<Tab>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("form");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setView("form");
      setError(null);
      setPassword("");
    }
  }, [open]);

  const callbackUrl = `${window.location.origin}/auth/callback?return_to=${encodeURIComponent(returnTo)}`;

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: callbackUrl,
    });
    if (result.error) {
      toast.error("This sign-in option is not yet available. Please try a different option.");
      setBusy(false);
    }
  };

  const handleApple = async () => {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: callbackUrl,
    });
    if (result.error) {
      toast.error("This sign-in option is not yet available. Please try a different option.");
      setBusy(false);
    }
  };

  const AppleIcon = () => (
    <svg className="h-4 w-4" viewBox="0 0 814 1000" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8-60 0-105.6-57.2-155.5-127C73.2 738.8 25 624.5 25 514.5c0-174.5 113.3-267 224.6-267 59.1 0 108.4 38.8 145.7 38.8 35.7 0 91.1-41.2 162.4-41.2 26.3 0 120.7 2.5 183.3 106.8h.1zM534.2 71.5c28.5-34.3 49.2-82 49.2-128.7 0-6.5-.6-13.1-1.7-18.4-46.9 1.7-102.5 31.3-135.9 70.4-26.3 30.5-51.8 78.3-51.8 127 0 7.4.8 14.9 1.5 17.2 3.1.8 8.1 1.1 12.4 1.1 41.9 0 95.1-27.9 125.5-68.6z" />
    </svg>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === "magic") {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: callbackUrl,
          },
        });
        if (err) {
          setError(err.message);
        } else {
          setView("sent");
        }
      } else {
        if (password.length < 8) {
          setError("Password must be at least 8 characters.");
          setBusy(false);
          return;
        }
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callbackUrl },
        });
        if (err) {
          const msg = err.message.toLowerCase();
          if (msg.includes("registered") || msg.includes("exists") || msg.includes("already")) {
            setError("An account with that email already exists.");
          } else {
            setError(err.message);
          }
        } else if (data.user) {
          // Immediately claim if session exists
          await claimPendingAnalysis();
          const sid = getSessionId();
          await supabase.rpc("claim_anonymous_analyses", {
            p_session_id: sid,
            p_user_id: data.user.id,
          });
          toast.success("Account created! Check your inbox to verify your email when you have a moment.");
          onClose();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {view === "sent" ? (
          <div className="flex flex-col items-center gap-3 px-2 py-4 text-center">
            <div className="rounded-full bg-muted p-3">
              <Mail className="h-6 w-6" />
            </div>
            <h2 className="text-[20px] font-medium tracking-tight">Check your inbox</h2>
            <p className="text-[14px] text-muted-foreground">
              We sent a magic link to <span className="text-foreground">{email}</span>. Click it
              to finish creating your account and save this report.
            </p>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Email not arriving? Check spam, or{" "}
              <button
                type="button"
                className="text-foreground underline"
                onClick={() => setView("form")}
              >
                use a different email
              </button>
              .
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-[22px] font-medium tracking-tight">Save this report</h2>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Create a free account to save this report and unlock features as we add them.
              </p>
            </div>

            <Button
              variant="outline"
              className="h-11 rounded-full"
              onClick={handleGoogle}
              disabled={busy}
            >
              Continue with Google
            </Button>

            <Button
              variant="outline"
              className="h-11 rounded-full"
              onClick={handleApple}
              disabled={busy}
            >
              <AppleIcon />
              <span className="ml-2">Continue with Apple</span>
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="save-email">Email</Label>
                <Input
                  id="save-email"
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex rounded-full bg-muted p-1 text-[13px]">
                <button
                  type="button"
                  onClick={() => setTab("magic")}
                  className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
                    tab === "magic" ? "bg-background shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  Send me a magic link
                </button>
                <button
                  type="button"
                  onClick={() => setTab("password")}
                  className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
                    tab === "password" ? "bg-background shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  Use a password
                </button>
              </div>

              {tab === "password" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="save-password">Password</Label>
                  <Input
                    id="save-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}

              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                  {error}{" "}
                  {error.toLowerCase().includes("already") && (
                    <a
                      href={`/auth?mode=signin&return_to=${encodeURIComponent(returnTo)}`}
                      className="underline"
                    >
                      Sign in instead
                    </a>
                  )}
                </div>
              )}

              <Button type="submit" disabled={busy} className="h-11 rounded-full">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tab === "magic" ? "Send magic link" : "Create account"}
              </Button>

              <p className="text-center text-[12px] text-muted-foreground">
                We'll never spam you. Easy unsubscribe anytime.
              </p>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
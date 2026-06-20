import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { claimPendingAnalysis } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";

type Mode = "signin" | "signup" | "forgot";

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialMode = (params.get("mode") as Mode) || "signin";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();

  const returnTo = params.get("return_to");
  const safeReturnTo = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : null;
  const postAuthDest = safeReturnTo ?? "/account";

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      await claimPendingAnalysis();
      if (!cancelled) navigate(postAuthDest, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate, postAuthDest]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${postAuthDest}` },
        });
        if (error) {
          if (error.message.toLowerCase().includes("registered") || error.message.toLowerCase().includes("exists")) {
            toast.error("Email already in use.", {
              action: { label: "Sign in", onClick: () => setMode("signin") },
            });
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Check your email to confirm your account.");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) toast.error(error.message);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) toast.error(error.message);
        else toast.success("Password reset email sent.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${postAuthDest}`,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Could not sign in with Google");
      setBusy(false);
    }
  };

  const handleApple = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: `${window.location.origin}${postAuthDest}`,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Could not sign in with Apple");
      setBusy(false);
    }
  };

  const AppleIcon = () => (
    <svg className="h-4 w-4" viewBox="0 0 814 1000" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8-60 0-105.6-57.2-155.5-127C73.2 738.8 25 624.5 25 514.5c0-174.5 113.3-267 224.6-267 59.1 0 108.4 38.8 145.7 38.8 35.7 0 91.1-41.2 162.4-41.2 26.3 0 120.7 2.5 183.3 106.8h.1zM534.2 71.5c28.5-34.3 49.2-82 49.2-128.7 0-6.5-.6-13.1-1.7-18.4-46.9 1.7-102.5 31.3-135.9 70.4-26.3 30.5-51.8 78.3-51.8 127 0 7.4.8 14.9 1.5 17.2 3.1.8 8.1 1.1 12.4 1.1 41.9 0 95.1-27.9 125.5-68.6z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-5 py-12 sm:px-8">
        <h1 className="text-[28px] font-medium tracking-tight">
          {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Sign In or Sign Up"}
        </h1>

        {mode !== "forgot" && (
          <>
            <Button variant="outline" onClick={handleGoogle} disabled={busy} className="h-11 rounded-full">
              Continue with Google
            </Button>
            <Button variant="outline" onClick={handleApple} disabled={busy} className="h-11 rounded-full">
              <AppleIcon />
              <span className="ml-2">Continue with Apple</span>
            </Button>
          </>
        )}

        {mode !== "forgot" && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        <form onSubmit={handleEmail} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode !== "forgot" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          <Button type="submit" disabled={busy} className="h-11 rounded-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset email" : "Sign in"}
          </Button>
        </form>

        <div className="text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button className="text-foreground underline" onClick={() => setMode("signup")}>
                Sign up
              </button>
            </>
          ) : mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button className="text-foreground underline" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          ) : (
            <button className="text-foreground underline" onClick={() => setMode("signin")}>
              Back to sign in
            </button>
          )}
        </div>

        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back home
        </Link>
      </main>
      <Footer />
    </div>
  );
};

export default Auth;
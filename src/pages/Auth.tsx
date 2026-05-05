import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
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
    if (!loading && user) navigate(postAuthDest, { replace: true });
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-12 sm:px-8">
        <h1 className="text-[28px] font-medium tracking-tight">
          {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Sign in"}
        </h1>

        {mode !== "forgot" && (
          <Button variant="outline" onClick={handleGoogle} disabled={busy} className="h-11 rounded-full">
            Continue with Google
          </Button>
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
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    navigate("/account", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Reset password — BetweenTheLines™</title>
        <meta name="description" content="Set a new password for your BetweenTheLines account and get back to your saved relationship reports." />
        <link rel="canonical" href="https://betweenthelines.app/reset-password" />
        <meta property="og:title" content="Reset password — BetweenTheLines™" />
        <meta property="og:description" content="Set a new password for your BetweenTheLines account." />
        <meta property="og:url" content="https://betweenthelines.app/reset-password" />
        <meta name="robots" content="noindex" />
      </Helmet>
      <Header />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-12 sm:px-8">
        <h1 className="text-[28px] font-medium tracking-tight">Set a new password</h1>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy} className="h-11 rounded-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default ResetPassword;
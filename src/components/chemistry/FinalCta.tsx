import { ArrowRight, Mail } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { logEvent } from "@/lib/session";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const startNewAnalysis = () => {
  logEvent("cta_clicked", { location: "final" });
  try {
    // Force a fresh session_id so the new analysis is independent of any
    // prior one, regardless of whether the user is anonymous or logged in.
    window.localStorage.removeItem("chemistry_session_id");
  } catch {
    // ignore storage errors
  }
  // Hard-navigate to the input section so the input form remounts with
  // clean state.
  window.location.assign("/#input-section");
};

const inviteSchema = z.object({
  from: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  friends: z.string().trim().min(1, "Add at least one friend's email"),
});

const parseFriendEmails = (raw: string): { valid: string[]; invalid: string[] } => {
  const parts = raw
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (emailRe.test(p) && p.length <= 255) valid.push(p);
    else invalid.push(p);
  }
  return { valid, invalid };
};

export const FinalCta = () => {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [email, setEmail] = useState("");
  const [friends, setFriends] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = inviteSchema.safeParse({ from, email, friends });
    if (!parsed.success) {
      toast({
        title: "Check your details",
        description: parsed.error.issues[0]?.message ?? "Invalid input",
        variant: "destructive",
      });
      return;
    }
    const { valid, invalid } = parseFriendEmails(friends);
    if (valid.length === 0) {
      toast({
        title: "No valid emails",
        description: "Add one or more friend emails separated by commas.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    logEvent("invite_friends_submitted", {
      from_name: parsed.data.from,
      from_email: parsed.data.email,
      invited_count: valid.length,
      invalid_count: invalid.length,
    });
    setTimeout(() => {
      setSubmitting(false);
      setOpen(false);
      setFrom("");
      setEmail("");
      setFriends("");
      toast({
        title: "Thanks for spreading the word!",
        description:
          invalid.length > 0
            ? `Recorded ${valid.length} invite${valid.length === 1 ? "" : "s"}. Skipped ${invalid.length} invalid email${invalid.length === 1 ? "" : "s"}.`
            : `Recorded ${valid.length} invite${valid.length === 1 ? "" : "s"}.`,
      });
    }, 300);
  };

  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mb-5 inline-flex items-center gap-2 text-[14px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <Mail className="h-4 w-4" /> Invite friends
        </button>
        <button
          onClick={startNewAnalysis}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
        >
          Start a new analysis <ArrowRight className="h-4 w-4" />
        </button>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {["🔒 Private by default", "⚡ Results in 90s", "💬 Optional feedback at the end"].map((p) => (
            <span
              key={p}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] text-muted-foreground"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle>Invite friends</SheetTitle>
            <SheetDescription>
              Share BetweenTheLines™ with people you think would enjoy it.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleInviteSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-from">From:</Label>
              <Input
                id="invite-from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="Your name"
                maxLength={100}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Your email:</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={255}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-friends">
                Emails of friends to invite{" "}
                <span className="text-muted-foreground">[separate by commas ","]</span>
              </Label>
              <Textarea
                id="invite-friends"
                value={friends}
                onChange={(e) => setFriends(e.target.value)}
                placeholder="friend1@example.com, friend2@example.com, friend3@example.com"
                rows={6}
                className="min-h-[140px]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send invites"}
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
};
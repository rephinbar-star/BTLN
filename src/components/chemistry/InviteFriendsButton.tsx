import { Mail } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { logEvent } from "@/lib/session";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

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

export const InviteFriendsButton = ({ className = "" }: { className?: string }) => {
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex w-full max-w-[280px] items-center justify-center gap-2.5 rounded-full border-2 border-[hsl(24,100%,45%)] bg-[hsl(25,95%,53%)] px-6 py-3 text-base font-bold text-white shadow-md transition-all hover:scale-110 hover:-translate-y-1 hover:shadow-2xl hover:bg-[hsl(24,100%,45%)] animate-[pulse_2s_ease-in-out_infinite] ${className}`}
      >
        <Mail className="h-5 w-5" /> Invite friends
      </button>

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
    </>
  );
};

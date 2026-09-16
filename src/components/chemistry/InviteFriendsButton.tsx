import { Mail } from "lucide-react";
import { logEvent } from "@/lib/session";
import { Button } from "@/components/ui/button";

export const InviteFriendsButton = ({ className = "" }: { className?: string }) => {
  const share = async () => {
    logEvent("invite_friends_clicked", {});
    const shareData = {
      title: "BetweenTheLines™",
      text: "A private way to understand the patterns in a conversation.",
      url: window.location.origin,
    };
    if (navigator.share) await navigator.share(shareData).catch(() => undefined);
    else await navigator.clipboard.writeText(window.location.origin);
  };

  return (
      <Button
        type="button"
        onClick={() => void share()}
        className={`w-full max-w-[280px] rounded-full ${className}`}
      >
        <Mail className="h-5 w-5" /> Share with friends
      </Button>
  );
};

import { useState } from "react";
import { ChevronDown, MessageSquare, Copy, Download, Camera } from "lucide-react";

type GuideId = "whatsapp" | "copypaste" | "screenshots";

const WhatsAppAnimation = () => {
  // Looping 3-step animation: open chat -> tap menu -> Export chat
  return (
    <div className="relative mx-auto h-[180px] w-[140px] overflow-hidden rounded-[18px] border border-border bg-background shadow-sm">
      {/* Phone status bar */}
      <div className="flex h-5 items-center justify-between bg-pastel-green-bg px-2 text-[8px] text-pastel-green-fg">
        <span>9:41</span>
        <span>●●●</span>
      </div>
      {/* Chat header */}
      <div className="flex items-center gap-1.5 bg-pastel-green-bg/70 px-2 py-1.5">
        <div className="h-4 w-4 rounded-full bg-pastel-green-fg/30" />
        <div className="text-[9px] font-medium text-pastel-green-fg">Alex</div>
        <div className="ml-auto animate-[pulse_2s_ease-in-out_infinite] text-[10px] text-pastel-green-fg">⋮</div>
      </div>
      {/* Messages */}
      <div className="space-y-1 px-2 py-2">
        <div className="ml-auto w-[60%] rounded-md bg-pastel-green-bg px-1.5 py-1 text-[7px] text-pastel-green-fg">
          hey :)
        </div>
        <div className="w-[55%] rounded-md bg-muted px-1.5 py-1 text-[7px] text-foreground">how was today?</div>
        <div className="ml-auto w-[65%] rounded-md bg-pastel-green-bg px-1.5 py-1 text-[7px] text-pastel-green-fg">
          really good actually
        </div>
      </div>
      {/* Animated overlay menu */}
      <div className="pointer-events-none absolute right-2 top-7 w-[90px] origin-top-right animate-[fadeMenu_4s_ease-in-out_infinite] rounded-md border border-border bg-card p-1 text-[8px] shadow-md">
        <div className="rounded px-1.5 py-1 text-foreground">View contact</div>
        <div className="rounded px-1.5 py-1 text-foreground">Search</div>
        <div className="rounded bg-pastel-purple-bg px-1.5 py-1 font-medium text-pastel-purple-fg">
          Export chat
        </div>
      </div>
      <style>{`
        @keyframes fadeMenu {
          0%, 20% { opacity: 0; transform: scale(0.9); }
          35%, 75% { opacity: 1; transform: scale(1); }
          90%, 100% { opacity: 0; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
};

const CopyPasteAnimation = () => {
  return (
    <div className="relative mx-auto h-[180px] w-[140px] overflow-hidden rounded-[18px] border border-border bg-background shadow-sm">
      <div className="flex h-5 items-center justify-between bg-pastel-blue-bg px-2 text-[8px] text-pastel-blue-fg">
        <span>9:41</span>
        <span>●●●</span>
      </div>
      <div className="space-y-1 px-2 py-2">
        <div className="relative w-[55%] rounded-md bg-muted px-1.5 py-1 text-[7px] text-foreground">
          hey, are we still on for tonight?
        </div>
        <div className="relative ml-auto w-[60%] rounded-md bg-pastel-blue-bg px-1.5 py-1 text-[7px] text-pastel-blue-fg">
          yes! 7pm right?
        </div>
        <div className="relative w-[58%] rounded-md bg-muted px-1.5 py-1 text-[7px] text-foreground">
          perfect, can't wait
        </div>
        <div className="relative ml-auto w-[50%] rounded-md bg-pastel-blue-bg px-1.5 py-1 text-[7px] text-pastel-blue-fg">
          me too 💕
        </div>
      </div>
      {/* Animated selection highlight */}
      <div className="pointer-events-none absolute inset-x-2 top-[28px] h-[120px] animate-[selectSweep_4s_ease-in-out_infinite] rounded-md bg-pastel-purple-fg/15 ring-1 ring-pastel-purple-fg/40" />
      {/* Floating Copy bubble */}
      <div className="pointer-events-none absolute left-1/2 top-9 -translate-x-1/2 animate-[copyPop_4s_ease-in-out_infinite] rounded-md bg-foreground px-2 py-0.5 text-[8px] font-medium text-background shadow">
        Copy
      </div>
      <style>{`
        @keyframes selectSweep {
          0%, 10% { opacity: 0; transform: scaleY(0.2); transform-origin: top; }
          25%, 70% { opacity: 1; transform: scaleY(1); }
          85%, 100% { opacity: 0; }
        }
        @keyframes copyPop {
          0%, 25% { opacity: 0; transform: translate(-50%, 6px); }
          35%, 65% { opacity: 1; transform: translate(-50%, 0); }
          80%, 100% { opacity: 0; transform: translate(-50%, -4px); }
        }
      `}</style>
    </div>
  );
};

const ScreenshotAnimation = () => {
  return (
    <div className="relative mx-auto h-[180px] w-[140px] overflow-hidden rounded-[18px] border border-border bg-background shadow-sm">
      <div className="flex h-5 items-center justify-between bg-pastel-amber-bg px-2 text-[8px] text-pastel-amber-fg-strong">
        <span>9:41</span>
        <span>●●●</span>
      </div>
      <div className="space-y-1 px-2 py-2">
        <div className="relative w-[55%] rounded-md bg-muted px-1.5 py-1 text-[7px] text-foreground">
          hey, are we still on for tonight?
        </div>
        <div className="relative ml-auto w-[60%] rounded-md bg-pastel-amber-bg px-1.5 py-1 text-[7px] text-pastel-amber-fg-strong">
          yes! 7pm right?
        </div>
        <div className="relative w-[58%] rounded-md bg-muted px-1.5 py-1 text-[7px] text-foreground">
          perfect, can't wait
        </div>
      </div>
      {/* Flash overlay */}
      <div className="pointer-events-none absolute inset-0 animate-[flash_3s_ease-in-out_infinite] bg-white/60" />
      {/* Shutter button */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 animate-[shutter_3s_ease-in-out_infinite]">
        <div className="h-6 w-6 rounded-full border-2 border-pastel-amber-fg-strong bg-white/80" />
      </div>
      <style>{`
        @keyframes flash {
          0%, 60% { opacity: 0; }
          65% { opacity: 1; }
          75% { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes shutter {
          0%, 55% { transform: translate(-50%, 0) scale(1); }
          62% { transform: translate(-50%, 0) scale(0.85); }
          70% { transform: translate(-50%, 0) scale(1); }
          100% { transform: translate(-50%, 0) scale(1); }
        }
      `}</style>
    </div>
  );
};

const guides: {
  id: GuideId;
  title: string;
  icon: typeof MessageSquare;
  steps: string[];
  animation: React.ReactNode;
}[] = [
  {
    id: "whatsapp",
    title: "Export a chat from WhatsApp",
    icon: Download,
    steps: [
      "Open the chat with your partner.",
      "Tap the ⋮ menu (Android) or the contact name (iPhone).",
      "Choose More → Export chat.",
      "Pick Without media, then save or share the .txt file.",
      "Upload it in the Chat file tab.",
    ],
    animation: <WhatsAppAnimation />,
  },
  {
    id: "copypaste",
    title: "Copy & paste from iMessage or any chat app",
    icon: Copy,
    steps: [
      "Open the conversation you want to analyze.",
      "Long-press a message and choose Select / More.",
      "Drag to highlight the messages you want — both sides.",
      "Tap Copy.",
      "Come back here and paste into the Paste Messages tab.",
    ],
    animation: <CopyPasteAnimation />,
  },
  {
    id: "screenshots",
    title: "Upload screenshots instead",
    icon: Camera,
    steps: [
      "Take screenshots of your conversation — both sides of the chat.",
      "Most phones: press Power + Volume Down (Android) or Power + Volume Up + Side button (iPhone).",
      "PNG or JPG both work. Upload multiple screenshots to hit 50+ messages.",
      "Switch to the Screenshots tab and upload your screenshot images.",
    ],
    animation: <ScreenshotAnimation />,
  },
];

export const HowToHelp = () => {
  const [open, setOpen] = useState<GuideId | null>(null);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-background">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        aria-expanded={expanded}
      >
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="flex-1 text-[13px] font-medium text-foreground">How To?</p>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded && (
      <div className="divide-y divide-border border-t border-border">
        {guides.map((g) => {
          const Icon = g.icon;
          const isOpen = open === g.id;
          return (
            <div key={g.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : g.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                aria-expanded={isOpen}
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-pastel-purple-bg text-pastel-purple-fg">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 text-[13px] text-foreground">{g.title}</span>
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="animate-fade-in px-4 pb-4">
                  <div className="grid gap-4 sm:grid-cols-[140px_1fr] sm:items-start">
                    <div className="flex justify-center sm:justify-start">{g.animation}</div>
                    <ol className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
                      {g.steps.map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-foreground">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

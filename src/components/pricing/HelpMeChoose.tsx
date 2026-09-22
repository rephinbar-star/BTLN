import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PRICING_BTN } from "@/lib/pricing/button";
import { track } from "@/lib/analytics";

/**
 * Optional three-question guide. No sign-in, no private message text, no
 * compulsory assessment: every step can be skipped and direct plan choices
 * on the page stay available. Analytics record the chosen branch only —
 * never free text.
 */

type Rec = {
  title: string;
  reason: string;
  price: string;
  primary: { to: string; label: string };
  example?: { to: string; label: string };
  availability?: string;
};

const REC: Record<string, Rec> = {
  quick_single: {
    title: "Quick Take",
    reason: "One message, one read: what it may mean and three ways to reply.",
    price: "First read free, then the Quick Take plan at $6.99/month.",
    primary: { to: "/quick", label: "Start a Quick Take" },
    example: { to: "/examples/quick-take", label: "See Example" },
  },
  quick_interactive: {
    title: "Quick Take + Interactive Mode",
    reason:
      "You want help as the conversation continues, not just on one message. Interactive Mode adds ongoing exchanges on top of Quick Take.",
    price: "$6.99/month + $2.99/month = $9.98/month combined.",
    primary: { to: "/quick", label: "Start a Quick Take" },
    example: { to: "/examples/quick-take", label: "See Example" },
    availability:
      "Interactive Mode is being built and cannot be bought yet. Quick Take works today.",
  },
  deep_one: {
    title: "Single report",
    reason: "One Deep Read of one conversation between two people.",
    price: "$4.99 one-time, attached to the report you start.",
    primary: { to: "/deep", label: "Start a Deep Read" },
    example: { to: "/examples/deep-read", label: "See Example" },
  },
  deep_ongoing: {
    title: "Monthly full-report plan",
    reason: "Deep Reads, Group Reads and Group Roasts whenever you want them.",
    price: "$9.99/month, or $49.99/year if you prefer yearly billing.",
    primary: { to: "/pricing#sec-reports", label: "See the full-report plan" },
    example: { to: "/examples/deep-read", label: "See Example" },
  },
  group_roast: {
    title: "Group Roast",
    reason: "A playful roast of your group chat, grounded in what was actually said.",
    price: "$4.99 one-time for that roast, or the $9.99/month plan.",
    primary: { to: "/group-roast", label: "Start a Group Roast" },
    example: { to: "/examples/group-roast", label: "See Example" },
  },
  group_read: {
    title: "Group Read",
    reason: "A serious read of the group: who holds it together and who drifts.",
    price: "$4.99 one-time for that report, or the $9.99/month plan.",
    primary: { to: "/group", label: "Start a Group Read" },
    example: { to: "/examples/group-read", label: "See Example" },
  },
  prime: {
    title: "Prime",
    reason:
      "You want your own patterns across relationships over time. Prime covers every mode plus Relationship360 and Interactive Mode.",
    price: "$19.99/month.",
    primary: { to: "/examples/relationship360", label: "See the Relationship360 preview" },
    example: { to: "/prime", label: "What's in Prime" },
    availability:
      "Relationship360 is still in development, so Prime cannot be purchased yet. The preview is fictional.",
  },
};

type Step = 1 | 2 | 3 | "result";

type Props = {
  /** Analytics source label only — never free text. */
  source?: string;
  /** "button" = prominent dark-green call-to-action (homepage). */
  variant?: "link" | "button";
  supportLine?: string;
};

export const HelpMeChoose = ({ source = "pricing_page", variant = "link", supportLine }: Props) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [q1, setQ1] = useState<string | null>(null);
  const [result, setResult] = useState<keyof typeof REC | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const restart = () => {
    setStep(1);
    setQ1(null);
    setResult(null);
  };

  const close = () => {
    setOpen(false);
    // Restore keyboard focus to the button that opened the guide.
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const finish = (key: keyof typeof REC) => {
    setResult(key);
    setStep("result");
    track("pricing_guide_result", { source, recommendation: key });
  };

  const choose1 = (value: string) => {
    setQ1(value);
    if (value === "prime") return finish("prime");
    setStep(2);
  };

  if (!open) {
    if (variant === "button") {
      return (
        <div className="mt-6">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => {
              setOpen(true);
              restart();
            }}
            className={`${PRICING_BTN} w-full sm:w-auto`}
          >
            Help me choose
          </button>
          {supportLine && (
            <p className="mt-2 text-[14px] text-muted-foreground">{supportLine}</p>
          )}
        </div>
      );
    }
    return (
      <div className="mt-6 text-center">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setOpen(true);
            restart();
          }}
          className="min-h-11 rounded-full border border-btln-line px-5 text-[15px] font-medium underline underline-offset-4 hover:bg-btln-mint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-btln-ink focus-visible:ring-offset-2"
        >
          Help me choose
        </button>
      </div>
    );
  }

  const Option = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 w-full rounded-2xl border border-btln-line bg-card px-4 py-3 text-left text-[15px] hover:bg-btln-mint/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-btln-ink focus-visible:ring-offset-2"
    >
      {label}
    </button>
  );

  const rec = result ? REC[result] : null;

  return (
    <section
      aria-label="Help me choose"
      className="mx-auto mt-6 w-full max-w-xl rounded-2xl border border-btln-line bg-card p-5 text-left"
    >
      {step === 1 && (
        <>
          <h2 className="text-[17px] font-medium">What would you like help with?</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Option label="A message and how to reply" onClick={() => choose1("quick")} />
            <Option label="Patterns between two people" onClick={() => choose1("deep")} />
            <Option label="Our group chat" onClick={() => choose1("group")} />
            <Option
              label="My patterns across relationships over time"
              onClick={() => choose1("prime")}
            />
          </div>
        </>
      )}

      {step === 2 && q1 === "quick" && (
        <>
          <h2 className="text-[17px] font-medium">
            One exchange, or help as the conversation continues?
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            <Option label="Just this one exchange" onClick={() => finish("quick_single")} />
            <Option
              label="Help as it continues — Interactive Mode"
              onClick={() => finish("quick_interactive")}
            />
          </div>
        </>
      )}

      {step === 2 && q1 === "deep" && (
        <>
          <h2 className="text-[17px] font-medium">One report, or ongoing reads?</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Option label="Just this one conversation" onClick={() => finish("deep_one")} />
            <Option label="I'll be reading regularly" onClick={() => setStep(3)} />
          </div>
        </>
      )}

      {step === 2 && q1 === "group" && (
        <>
          <h2 className="text-[17px] font-medium">A funny roast or a deeper read of the group?</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Option label="A funny roast" onClick={() => finish("group_roast")} />
            <Option label="A deeper read" onClick={() => finish("group_read")} />
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="text-[17px] font-medium">One mode, or several?</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Option label="Mostly reports of conversations" onClick={() => finish("deep_ongoing")} />
            <Option
              label="Every mode, plus my own patterns over time"
              onClick={() => finish("prime")}
            />
          </div>
        </>
      )}

      {step === "result" && rec && (
        <>
          <h2 className="text-[17px] font-medium">{rec.title}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{rec.reason}</p>
          <p className="mt-2 text-[14px] font-medium">{rec.price}</p>
          {rec.availability && (
            <p className="mt-2 text-[13px] text-muted-foreground">{rec.availability}</p>
          )}
          <Link to={rec.primary.to} className={`mt-4 ${PRICING_BTN}`}>
            {rec.primary.label}
          </Link>
          {rec.example && (
            <p className="mt-3 text-[14px]">
              <Link to={rec.example.to} className="underline underline-offset-4">
                {rec.example.label}
              </Link>
            </p>
          )}
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-4 text-[14px]">
        {step !== 1 && (
          <button type="button" onClick={restart} className="underline underline-offset-4">
            Restart
          </button>
        )}
        {step === 2 && (
          <button type="button" onClick={() => setStep(1)} className="underline underline-offset-4">
            Back
          </button>
        )}
        {step === 3 && (
          <button type="button" onClick={() => setStep(2)} className="underline underline-offset-4">
            Back
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="underline underline-offset-4"
        >
          {step === "result" ? "Close" : "Skip — show me all plans"}
        </button>
      </div>
    </section>
  );
};

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId, logEvent } from "@/lib/session";
import { track } from "@/lib/analytics";
import { compressImage, dataUrlByteSize } from "@/lib/image-compress";

const MAX_SHOTS = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type Shot = {
  id: string;
  name: string;
  dataUrl: string;
  status: "compressing" | "ready";
};

type Side = "none" | "left" | "right";

export const DecodeInput = () => {
  const [shots, setShots] = useState<Shot[]>([]);
  const [text, setText] = useState("");
  const [side, setSide] = useState<Side>("none");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const addFiles = (files: FileList | File[]) => {
    setError(null);
    const incoming = Array.from(files);
    const remaining = MAX_SHOTS - shots.length;
    if (remaining <= 0) {
      setError(`You can add up to ${MAX_SHOTS} screenshots.`);
      return;
    }
    const accepted: File[] = [];
    for (const f of incoming.slice(0, remaining)) {
      if (f.type !== "image/png" && f.type !== "image/jpeg") {
        setError("Only PNG and JPG images are supported.");
        continue;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        setError(`"${f.name}" is too large (max 4 MB).`);
        continue;
      }
      accepted.push(f);
    }
    if (incoming.length > remaining) setError(`Only the first ${MAX_SHOTS} screenshots are used.`);
    const placeholders: Shot[] = accepted.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      dataUrl: "",
      status: "compressing",
    }));
    setShots((prev) => [...prev, ...placeholders]);
    accepted.forEach(async (file, idx) => {
      const pid = placeholders[idx].id;
      try {
        const { dataUrl } = await compressImage(file);
        setShots((prev) =>
          prev.map((s) => (s.id === pid ? { ...s, dataUrl, status: "ready" as const } : s)),
        );
      } catch {
        setShots((prev) => prev.filter((s) => s.id !== pid));
        setError(`Could not read ${file.name}.`);
      }
    });
  };

  const removeShot = (id: string) => setShots((prev) => prev.filter((s) => s.id !== id));

  const ready = shots.filter((s) => s.status === "ready");
  const busy = shots.some((s) => s.status === "compressing");
  const canSubmit = !submitting && !busy && (ready.length > 0 || text.trim().length > 0);

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const session_id = getSessionId();
    const decode_id = crypto.randomUUID();

    const { error: insErr } = await supabase.from("decodes").insert({
      id: decode_id,
      session_id,
      status: "pending",
      source: "quick_decode",
    });
    if (insErr) {
      setSubmitting(false);
      setError("Something went wrong starting your decode. Please try again.");
      return;
    }

    const names =
      side === "none"
        ? {}
        : side === "left"
          ? { name1: "Left", name2: "Right" }
          : { name1: "Right", name2: "Left" };

    const input: Record<string, unknown> = { ...names };
    if (ready.length > 0) {
      input.screenshot_base64_array = ready.map((s) => s.dataUrl);
    } else {
      input.raw_text = text.trim();
    }

    logEvent("decode_started", {
      has_images: ready.length > 0,
      image_count: ready.length,
    });
    track("decode_started", { input_method: ready.length > 0 ? "screenshot" : "paste" });

    navigate(`/decode/${decode_id}`);

    void supabase.functions.invoke("decode-conversation", {
      body: { decode_id, session_id, source: "quick_decode", input },
    });
  };

  const totalBytes = ready.reduce((n, s) => n + dataUrlByteSize(s.dataUrl), 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        className="rounded-xl border border-dashed border-border p-4"
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[15px] font-medium text-foreground hover:bg-muted/50"
        >
          <ImagePlus className="h-4 w-4" />
          Add a screenshot {shots.length > 0 ? `(${shots.length}/${MAX_SHOTS})` : `(up to ${MAX_SHOTS})`}
        </button>

        {shots.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {shots.map((s) => (
              <li key={s.id} className="relative overflow-hidden rounded-lg border border-border bg-muted/40">
                {s.status === "ready" ? (
                  <img src={s.dataUrl} alt="" className="h-24 w-full object-cover" />
                ) : (
                  <div className="flex h-24 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${s.name}`}
                  onClick={() => removeShot(s.id)}
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {ready.length > 0 && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            {(totalBytes / 1024).toFixed(0)} KB ready
          </p>
        )}
      </div>

      <div className="my-4 flex items-center gap-3 text-[12px] uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or paste it <span className="h-px flex-1 bg-border" />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={`Them: hey, sorry — crazy week\nYou: no worries! still on for Friday?`}
        aria-label="Paste the messages"
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted-foreground">Which side is you?</span>
        {(["none", "left", "right"] as Side[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            aria-pressed={side === s}
            className={`rounded-full border px-3 py-1 transition-colors ${
              side === s
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "none" ? "Skip" : s === "left" ? "Left" : "Right"}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Decode this <ArrowRight className="h-4 w-4" />
      </button>
      <p className="mt-3 text-center text-[12px] text-muted-foreground">
        Free. No account. Messages deleted after decoding.
      </p>
    </div>
  );
};
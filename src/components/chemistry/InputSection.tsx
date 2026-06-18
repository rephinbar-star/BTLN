import { ArrowRight, Info, Upload, FileText, Image as ImageIcon, X, Lock, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId, logEvent, setPendingClaimAnalysisId } from "@/lib/session";
import { compressImage, dataUrlByteSize } from "@/lib/image-compress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HowToHelp } from "./HowToHelp";

type FormState = {
  conversation: string;
  relationshipType: "romantic" | "friend" | "family";
  stage: string;
  duration: string;
  goal: string;
  context: string;
  yourName: string;
  theirName: string;
};

const initialState: FormState = {
  conversation: "",
  relationshipType: "romantic",
  stage: "",
  duration: "",
  goal: "",
  context: "",
  yourName: "",
  theirName: "",
};

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-0";

const labelClass = "text-[13px] font-medium text-foreground";

type InputMode = "paste" | "file" | "screenshots";
type Screenshot = {
  id: string;
  name: string;
  size: number; // compressed bytes (approx, decoded)
  originalBytes: number;
  dataUrl: string;
  status: "compressing" | "ready";
};

// Cap kept conservative so the JSON payload sent to the Edge Function
// stays well under the per-request body limit on mobile networks.
const MAX_SCREENSHOTS = 10;
// Pre-compression per-image hard cap. Post-compression images are typically
// well under 200 KB, so 2 MB pre-compression is plenty of headroom while
// still rejecting weird/huge inputs early.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TXT_BYTES = 5 * 1024 * 1024;
// Hard ceiling for the combined COMPRESSED payload we send to the Edge
// Function. 4 MB of decoded image data ≈ ~5.4 MB of base64, comfortably
// inside the Supabase Functions request body limit.
const MAX_TOTAL_UPLOAD_BYTES = 4 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

type QACardProps = {
  icon: typeof Lock;
  question: string;
  answer: string;
  tone: "muted" | "blue";
};

const QACard = ({ icon: Icon, question, answer, tone }: QACardProps) => {
  const [open, setOpen] = useState(false);
  const toneClasses =
    tone === "blue"
      ? "bg-pastel-blue-bg text-pastel-blue-fg"
      : "border border-border bg-muted/40 text-foreground";
  return (
    <div className={`rounded-xl ${toneClasses}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <p className="flex-1 text-[13px] font-semibold leading-relaxed">{question}</p>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="animate-fade-in px-4 pb-4 pl-11 text-[13px] leading-relaxed">{answer}</p>
      )}
    </div>
  );
};

type InputSectionProps = {
  hideIntro?: boolean;
};

export const InputSection = ({ hideIntro = false }: InputSectionProps = {}) => {
  const [form, setForm] = useState<FormState>(initialState);
  const [mode, setMode] = useState<InputMode>("paste");
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [pendingMode, setPendingMode] = useState<InputMode | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [inputStartedFired, setInputStartedFired] = useState(false);
  const txtInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const fireInputStarted = () => {
    if (inputStartedFired) return;
    setInputStartedFired(true);
    logEvent("input_started", { tab: mode });
  };

  const hasTextData = () => form.conversation.trim().length > 0;
  const hasScreenshotData = () => screenshots.length > 0;

  const requestModeChange = (next: InputMode) => {
    if (next === mode) return;
    logEvent("tab_selected", { tab: next });
    const leavingText = (mode === "paste" || mode === "file") && next === "screenshots" && hasTextData();
    const leavingImages = mode === "screenshots" && (next === "paste" || next === "file") && hasScreenshotData();
    if (leavingText || leavingImages) {
      setPendingMode(next);
      return;
    }
    setMode(next);
  };

  const confirmModeChange = () => {
    if (!pendingMode) return;
    if ((mode === "paste" || mode === "file") && pendingMode === "screenshots") {
      update("conversation", "");
      setLoadedFileName(null);
    } else if (mode === "screenshots") {
      setScreenshots([]);
    }
    setMode(pendingMode);
    setPendingMode(null);
  };

  const handleTxtFile = (file: File) => {
    setFileError(null);
    fireInputStarted();
    if (!file.name.toLowerCase().endsWith(".txt") && file.type !== "text/plain") {
      setFileError("Please upload a .txt file.");
      return;
    }
    if (file.size > MAX_TXT_BYTES) {
      setFileError("File is too large (max 5 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      update("conversation", text);
      setLoadedFileName(file.name);
      setMode("paste");
    };
    reader.onerror = () => setFileError("Could not read file.");
    reader.readAsText(file);
  };

  const handleImageFiles = (files: FileList | File[]) => {
    setImageError(null);
    fireInputStarted();
    const incoming = Array.from(files);
    const remaining = MAX_SCREENSHOTS - screenshots.length;
    if (remaining <= 0) {
      setImageError(`You can upload at most ${MAX_SCREENSHOTS} images.`);
      return;
    }
    const accepted: File[] = [];
    for (const f of incoming) {
      if (accepted.length >= remaining) {
        setImageError(`Only the first ${MAX_SCREENSHOTS} images were kept.`);
        break;
      }
      if (f.type !== "image/png" && f.type !== "image/jpeg") {
        setImageError("Only PNG and JPG images are supported.");
        continue;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        setImageError(`"${f.name}" is too large (max 2 MB).`);
        continue;
      }
      accepted.push(f);
    }
    // Insert placeholders immediately so the user sees a "Compressing…"
    // state, then replace each one as compression finishes.
    const placeholders: Screenshot[] = accepted.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: 0,
      originalBytes: file.size,
      dataUrl: "",
      status: "compressing",
    }));
    setScreenshots((prev) => [...prev, ...placeholders]);

    accepted.forEach(async (file, idx) => {
      const placeholderId = placeholders[idx].id;
      try {
        const { dataUrl, originalBytes } = await compressImage(file);
        const compressedSize = dataUrlByteSize(dataUrl);
        setScreenshots((prev) => {
          const next = prev.map((s) =>
            s.id === placeholderId
              ? { ...s, dataUrl, size: compressedSize, originalBytes, status: "ready" as const }
              : s,
          );
          // When this batch finishes (no more compressing entries), log telemetry.
          if (!next.some((s) => s.status === "compressing")) {
            const original_total_bytes = next.reduce((a, s) => a + s.originalBytes, 0);
            const compressed_total_bytes = next.reduce((a, s) => a + s.size, 0);
            logEvent("screenshot_compression_complete", {
              original_total_bytes,
              compressed_total_bytes,
              image_count: next.length,
            });
          }
          return next;
        });
      } catch {
        setScreenshots((prev) => prev.filter((s) => s.id !== placeholderId));
        setImageError(`Could not read "${file.name}". Try another image.`);
      }
    });
  };

  const removeScreenshot = (id: string) =>
    setScreenshots((prev) => prev.filter((s) => s.id !== id));

  const validate = (): { ok: true } | { ok: false; errors: typeof fieldErrors; banner?: string } => {
    const errors: typeof fieldErrors = {};
    let banner: string | undefined;

    if (mode === "paste") {
      if (form.conversation.trim().length < 100) {
        errors.conversation = "Paste at least 100 characters of conversation.";
      }
    } else if (mode === "file") {
      if (form.conversation.trim().length < 100) {
        banner = "Upload a chat file with at least 100 characters of conversation.";
      }
    } else if (mode === "screenshots") {
      if (screenshots.length < 1) {
        banner = "Upload at least one screenshot.";
      }
    }

    if (!form.yourName.trim()) errors.yourName = "Required.";
    if (!form.theirName.trim()) errors.theirName = "Required.";
    if (!form.stage) errors.stage = "Select an option.";
    if (!form.duration) errors.duration = "Select an option.";
    if (!form.goal) errors.goal = "Select an option.";

    if (Object.keys(errors).length === 0 && !banner) return { ok: true };
    return { ok: false, errors, banner };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    const v = validate();
    if (v.ok === false) {
      setFieldErrors(v.errors);
      setSubmitError(v.banner ?? "Please fix the highlighted fields.");
      return;
    }

    // Block submit while images are still compressing.
    if (mode === "screenshots" && screenshots.some((s) => s.status === "compressing")) {
      setSubmitError("Still compressing your images — give it a second and try again.");
      return;
    }

    setSubmitting(true);
    try {
      const session_id = getSessionId();
      const input_method: "paste" | "chat_file" | "screenshot" =
        mode === "paste" ? "paste" : mode === "file" ? "chat_file" : "screenshot";

      const context_data = {
        name1: form.yourName.trim(),
        name2: form.theirName.trim(),
        relationship_type: form.relationshipType,
        relationship_stage: form.stage,
        duration: form.duration,
        goal: form.goal,
        free_text: form.context.trim(),
      };

      // Pre-flight payload check for screenshot uploads — better to fail
      // here with a clear message than to ship a too-large request that
      // mobile networks will silently drop.
      if (input_method === "screenshot") {
        const totalBytes = screenshots.reduce(
          (acc, s) => acc + dataUrlByteSize(s.dataUrl),
          0,
        );
        if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
          setSubmitting(false);
          setSubmitError("Too many or too large images. Please remove some and try again.");
          return;
        }
      }

      logEvent("analysis_started", {
        input_method,
        has_free_text: context_data.free_text.length > 0,
        message_estimate_chars:
          input_method === "screenshot" ? 0 : form.conversation.length,
      });

      // 1. Create analyses row first
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id ?? null;
      const { data: created, error: createErr } = await supabase
        .from("analyses")
        .insert([
          {
            session_id,
            context_data: context_data as never,
            input_method,
            status: "pending",
            relationship_type: form.relationshipType,
            user_id: currentUserId,
          },
        ])
        .select("id")
        .single();

      if (createErr || !created) {
        setSubmitError(
          createErr?.message ?? "Could not start the analysis. Please try again.",
        );
        setSubmitting(false);
        return;
      }

      const analysis_id = created.id as string;
      if (!currentUserId) {
        setPendingClaimAnalysisId(analysis_id);
      }

      // 2. Kick off the Edge Function. The function uses
      //    EdgeRuntime.waitUntil() and returns 202 almost immediately, so
      //    we DO await the initial response — that way we can detect
      //    "request never even reached the server" errors (e.g. the giant
      //    payload was dropped on a flaky mobile connection) and surface
      //    them, instead of letting Processing hang for 4 minutes.
      const payload: Record<string, unknown> = {
        analysis_id,
        session_id,
        context_data,
        input_method,
      };
      if (input_method === "screenshot") {
        payload.screenshot_base64_array = screenshots.map((s) => s.dataUrl);
      } else {
        payload.raw_text = form.conversation;
      }

      // Navigate to the processing page right away so the user sees
      // progress, then dispatch the request in the background. If the
      // request itself fails (network dropped, payload rejected, etc.),
      // mark the analysis row as failed so polling resolves to a
      // proper error page instead of timing out after 4 minutes.
      navigate(`/processing/${analysis_id}`);

      void supabase.functions
        .invoke("analyze-conversation", { body: payload })
        .then(async ({ error }) => {
          if (error) {
            await supabase
              .from("analyses")
              .update({
                status: "failed",
                error_message:
                  "We couldn't send your screenshots to our analyzer. This usually means the upload was too large for your connection — try fewer images.",
                completed_at: new Date().toISOString(),
              })
              .eq("id", analysis_id);
          }
        })
        .catch(async () => {
          await supabase
            .from("analyses")
            .update({
              status: "failed",
              error_message:
                "We couldn't reach the analyzer. Please check your connection and try again.",
              completed_at: new Date().toISOString(),
            })
            .eq("id", analysis_id);
        });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error.";
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  const totalImageBytes = screenshots.reduce((acc, s) => acc + s.size, 0);

  const tabs: { id: InputMode; label: string; shortLabel: string; icon: typeof FileText }[] = [
    { id: "paste", label: "Paste Messages", shortLabel: "Paste Messages", icon: FileText },
    { id: "file", label: "Chat file", shortLabel: "Chat file", icon: Upload },
    { id: "screenshots", label: "Screenshots", shortLabel: "Screenshots", icon: ImageIcon },
  ];

  return (
    <section id="input-section" className="scroll-mt-24 -mt-[10px] px-5 pb-12 pt-0 sm:px-8 sm:pb-16 sm:pt-[13px]">
      {!hideIntro && (
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[28px] font-medium tracking-tight sm:text-[36px]">Are you a Power Couple? Find out for free</h2>
          <p className="mt-3 text-[16px] text-muted-foreground sm:text-[18px]">
            Takes about 90 seconds. Free, no signup.
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mx-auto mt-10 max-w-[720px] rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        {/* How many messages Q&A */}
        <QACard
          icon={Info}
          question="How many messages should I paste?"
          answer="For best results: paste at least 50 messages. More is better — the analysis gets sharper with 100+ messages spanning a few weeks. Below 30 messages, we can only give you a rough read."
          tone="blue"
        />

        {/* How-to help */}
        <div className="mt-3">
          <HowToHelp />
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-1 rounded-xl bg-muted p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => requestModeChange(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12px] font-medium transition-colors sm:text-[13px] ${
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="mt-4">
          {mode === "paste" && (
            <>
              <textarea
                value={form.conversation}
                onChange={(e) => {
                  update("conversation", e.target.value);
                  fireInputStarted();
                }}
                placeholder="Paste a chunk of your conversation here. Both sides — at least 30 messages works best. We'll figure out who said what."
                className={`${fieldClass} h-[200px] resize-none leading-relaxed`}
              />
              {fieldErrors.conversation && (
                <p className="mt-2 text-[12px] text-destructive">{fieldErrors.conversation}</p>
              )}
              {loadedFileName && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Loaded from <span className="font-medium text-foreground">{loadedFileName}</span>
                </p>
              )}
            </>
          )}

          {mode === "file" && (
            <div>
              <input
                ref={txtInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleTxtFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => txtInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleTxtFile(f);
                }}
                className="flex h-[200px] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-background px-6 text-center transition-colors hover:border-foreground/40 hover:bg-muted/40"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="text-[14px] font-medium text-foreground">Drop a .txt file or click to browse</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Exported chat from WhatsApp, iMessage, etc. Max 5 MB.
                  </p>
                </div>
              </button>
              {fileError && <p className="mt-2 text-[12px] text-destructive">{fileError}</p>}
            </div>
          )}

          {mode === "screenshots" && (
            <div>
              <input
                ref={imgInputRef}
                type="file"
                accept="image/png,image/jpeg"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleImageFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={screenshots.length >= MAX_SCREENSHOTS}
                onClick={() => imgInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) handleImageFiles(e.dataTransfer.files);
                }}
                className="flex h-[140px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background px-6 text-center transition-colors hover:border-foreground/40 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="text-[14px] font-medium text-foreground">
                    {screenshots.length >= MAX_SCREENSHOTS
                      ? `Maximum of ${MAX_SCREENSHOTS} images reached`
                      : "Drop screenshots or click to browse"}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">PNG or JPG, up to {MAX_SCREENSHOTS} images, 2 MB each.</p>
                </div>
              </button>

              {screenshots.length > 0 && (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {screenshots.map((s) => (
                      <div
                        key={s.id}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                      >
                        {s.status === "ready" ? (
                          <img src={s.dataUrl} alt={s.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                            Compressing…
                          </div>
                        )}
                        {s.status === "ready" && (
                          <div className="absolute bottom-1 left-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[10px] font-medium text-background">
                            {formatBytes(s.size)} · Compressed
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeScreenshot(s.id)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                          aria-label={`Remove ${s.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[12px] text-muted-foreground">
                    {screenshots.length} of {MAX_SCREENSHOTS} images · {formatBytes(totalImageBytes)} total compressed
                    {screenshots.some((s) => s.status === "compressing") && " · compressing…"}
                  </p>
                </>
              )}

              {imageError && <p className="mt-2 text-[12px] text-destructive">{imageError}</p>}
            </div>
          )}
        </div>

        {/* Q&A cards */}
        <div className="mt-4 space-y-3">
          <QACard
            icon={Lock}
            question="Is my data private?"
            answer="Your messages are deleted immediately after analysis. Nothing is stored."
            tone="muted"
          />
        </div>

        {/* Relationship type */}
        <div className="mt-5">
          <label className={labelClass}>Relationship type</label>
          <div className="mt-1.5 flex gap-2" role="radiogroup" aria-label="Relationship type">
            {([
              { value: "romantic", label: "Romantic" },
              { value: "friend", label: "Friend" },
              { value: "family", label: "Family" },
            ] as const).map((opt) => {
              const active = form.relationshipType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update("relationshipType", opt.value)}
                  className={`flex-1 rounded-full border px-4 py-2.5 text-[14px] font-medium transition-colors ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dropdowns */}
        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label className={labelClass}>Relationship stage</label>
            <select
              value={form.stage}
              onChange={(e) => update("stage", e.target.value)}
              className={`${fieldClass} mt-1.5 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[length:12px] bg-[position:right_1rem_center] bg-no-repeat pr-10`}
            >
              <option value="">Select…</option>
              <option>Dating, not exclusive</option>
              <option>Dating, exclusive</option>
              <option>Living together</option>
              <option>Engaged</option>
              <option>Married</option>
              <option>Other</option>
            </select>
            {fieldErrors.stage && <p className="mt-1 text-[12px] text-destructive">{fieldErrors.stage}</p>}
          </div>
          <div>
            <label className={labelClass}>How long have you been together</label>
            <select
              value={form.duration}
              onChange={(e) => update("duration", e.target.value)}
              className={`${fieldClass} mt-1.5 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[length:12px] bg-[position:right_1rem_center] bg-no-repeat pr-10`}
            >
              <option value="">Select…</option>
              <option>Under a month</option>
              <option>1–3 months</option>
              <option>3–6 months</option>
              <option>6 months – 1 year</option>
              <option>1–2 years</option>
              <option>2–5 years</option>
              <option>5+ years</option>
            </select>
            {fieldErrors.duration && <p className="mt-1 text-[12px] text-destructive">{fieldErrors.duration}</p>}
          </div>
          <div>
            <label className={labelClass}>What are you hoping to learn?</label>
            <select
              value={form.goal}
              onChange={(e) => update("goal", e.target.value)}
              className={`${fieldClass} mt-1.5 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[length:12px] bg-[position:right_1rem_center] bg-no-repeat pr-10`}
            >
              <option value="">Select…</option>
              <option>Just curious</option>
              <option>Trying to understand a pattern</option>
              <option>Red flag check</option>
              <option>Strengthening our communication</option>
              <option>Deciding whether to commit</option>
            </select>
            {fieldErrors.goal && <p className="mt-1 text-[12px] text-destructive">{fieldErrors.goal}</p>}
          </div>
          <div>
            <label className={labelClass}>Anything we should know? (optional)</label>
            <input
              type="text"
              value={form.context}
              onChange={(e) => update("context", e.target.value)}
              placeholder="e.g., we're long-distance, just had a fight, etc."
              className={`${fieldClass} mt-1.5`}
            />
          </div>

          {/* Names */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Your name</label>
              <input
                type="text"
                value={form.yourName}
                onChange={(e) => update("yourName", e.target.value)}
                className={`${fieldClass} mt-1.5`}
              />
              {fieldErrors.yourName && <p className="mt-1 text-[12px] text-destructive">{fieldErrors.yourName}</p>}
            </div>
            <div>
              <label className={labelClass}>Their name</label>
              <input
                type="text"
                value={form.theirName}
                onChange={(e) => update("theirName", e.target.value)}
                className={`${fieldClass} mt-1.5`}
              />
              {fieldErrors.theirName && <p className="mt-1 text-[12px] text-destructive">{fieldErrors.theirName}</p>}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-7 flex flex-col items-center">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90 sm:w-auto sm:min-w-[280px]"
          >
            {submitting ? "Starting…" : "Read Between The Lines"} <ArrowRight className="h-4 w-4" />
          </button>
          {submitError && <p className="mt-3 text-[12px] text-destructive">{submitError}</p>}
          <p className="mt-4 max-w-md text-center text-[12px] leading-relaxed text-muted-foreground">
            By continuing, you agree your messages will be processed by AI and deleted immediately after.
          </p>
        </div>
      </form>

      <AlertDialog open={pendingMode !== null} onOpenChange={(open) => !open && setPendingMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch input method?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching tabs will clear your current input. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmModeChange}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
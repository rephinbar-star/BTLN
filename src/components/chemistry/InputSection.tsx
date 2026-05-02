import { ArrowRight, Info, Upload, FileText, Image as ImageIcon, X } from "lucide-react";
import { useRef, useState } from "react";
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

type FormState = {
  conversation: string;
  stage: string;
  duration: string;
  goal: string;
  context: string;
  yourName: string;
  theirName: string;
};

const initialState: FormState = {
  conversation: "",
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
type Screenshot = { id: string; name: string; size: number; dataUrl: string };

const MAX_SCREENSHOTS = 20;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TXT_BYTES = 5 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const InputSection = () => {
  const [form, setForm] = useState<FormState>(initialState);
  const [mode, setMode] = useState<InputMode>("paste");
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [pendingMode, setPendingMode] = useState<InputMode | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const txtInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const hasTextData = () => form.conversation.trim().length > 0;
  const hasScreenshotData = () => screenshots.length > 0;

  const requestModeChange = (next: InputMode) => {
    if (next === mode) return;
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
        setImageError(`"${f.name}" is too large (max 10 MB).`);
        continue;
      }
      accepted.push(f);
    }
    accepted.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        setScreenshots((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, size: file.size, dataUrl },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeScreenshot = (id: string) =>
    setScreenshots((prev) => prev.filter((s) => s.id !== id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!hasTextData() && !hasScreenshotData()) {
      setSubmitError("Paste your conversation, upload a chat file, or add screenshots first.");
      return;
    }
    // Backend wiring comes in a later prompt — log captured state for now.
    // eslint-disable-next-line no-console
    console.log("Chemistry form submitted:", {
      ...form,
      screenshots: screenshots.map((s) => ({ name: s.name, size: s.size, dataUrl: s.dataUrl })),
    });
  };

  const totalImageBytes = screenshots.reduce((acc, s) => acc + s.size, 0);

  const tabs: { id: InputMode; label: string; shortLabel: string; icon: typeof FileText }[] = [
    { id: "paste", label: "Paste Messages", shortLabel: "Paste Messages", icon: FileText },
    { id: "file", label: "Chat file", shortLabel: "Chat file", icon: Upload },
    { id: "screenshots", label: "Screenshots", shortLabel: "Screenshots", icon: ImageIcon },
  ];

  return (
    <section id="input-section" className="scroll-mt-24 px-5 pb-12 pt-8 sm:px-8 sm:pb-16 sm:pt-12">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-[28px] font-medium tracking-tight sm:text-[36px]">Try it now</h2>
        <p className="mt-3 text-[16px] text-muted-foreground sm:text-[18px]">
          Takes about 90 seconds. Free, no signup.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto mt-10 max-w-[720px] rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        {/* Info callout */}
        <div className="flex items-start gap-3 rounded-xl bg-pastel-blue-bg p-4 text-pastel-blue-fg">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="text-[13px] leading-relaxed">
            For best results: paste at least 50 messages. More is better — the analysis gets sharper with 100+
            messages spanning a few weeks. Below 30 messages, we can only give you a rough read.
          </p>
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
                onChange={(e) => update("conversation", e.target.value)}
                placeholder="Paste a chunk of your conversation here. Both sides — at least 30 messages works best. We'll figure out who said what."
                className={`${fieldClass} h-[200px] resize-none leading-relaxed`}
              />
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
                  <p className="mt-1 text-[12px] text-muted-foreground">PNG or JPG, up to {MAX_SCREENSHOTS} images, 10 MB each.</p>
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
                        <img src={s.dataUrl} alt={s.name} className="h-full w-full object-cover" />
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
                    {screenshots.length} of {MAX_SCREENSHOTS} images · {formatBytes(totalImageBytes)} total
                  </p>
                </>
              )}

              {imageError && <p className="mt-2 text-[12px] text-destructive">{imageError}</p>}
            </div>
          )}
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
            </div>
            <div>
              <label className={labelClass}>Their name</label>
              <input
                type="text"
                value={form.theirName}
                onChange={(e) => update("theirName", e.target.value)}
                className={`${fieldClass} mt-1.5`}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-7 flex flex-col items-center">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90 sm:w-auto sm:min-w-[280px]"
          >
            Analyze my chemistry <ArrowRight className="h-4 w-4" />
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
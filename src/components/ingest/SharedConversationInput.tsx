import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, FileText, ImagePlus, Loader2, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readChatFile, UnsupportedFileError } from "@/lib/ingest/file";
import { parseTranscript, UnsupportedFormatError } from "@/lib/ingest/parse";
import { canonicalizeParsedConversation, canonicalScreenshotConversation, type CanonicalConversation, type CanonicalSourceKind } from "@/lib/ingest/canonical";
import { prepareScreenshot, SCREENSHOT_ACCEPT, SCREENSHOT_LIMITS, ScreenshotValidationError, type PreparedScreenshot } from "@/lib/ingest/images";
import type { TranscriptCandidate } from "@/lib/ingest/archive";

export type ConversationDraft = {
  method: CanonicalSourceKind;
  text: string;
  screenshots: PreparedScreenshot[];
  conversation: CanonicalConversation | null;
  selfParticipantId: string | null;
  screenshotSelfSide: "left" | "right" | null;
};

type Props = {
  value: ConversationDraft;
  onChange: (value: ConversationDraft) => void;
  maxScreenshots?: number;
  compact?: boolean;
  requireSelf?: boolean;
  pastePlaceholder?: string;
  extractScreenshots?: (screenshots: PreparedScreenshot[], selfSide: "left" | "right") => Promise<CanonicalConversation>;
};

const ACCEPT_EXPORT = ".txt,.csv,text/plain,text/csv,.zip,application/zip,application/x-zip-compressed";
const tabs: { id: CanonicalSourceKind; label: string }[] = [
  { id: "screenshots", label: "Screenshots" },
  { id: "chat_export", label: "Chat export" },
  { id: "paste", label: "Paste text" },
];

export const emptyConversationDraft = (): ConversationDraft => ({
  method: "screenshots",
  text: "",
  screenshots: [],
  conversation: null,
  selfParticipantId: null,
  screenshotSelfSide: null,
});

export function SharedConversationInput({ value, onChange, maxScreenshots = SCREENSHOT_LIMITS.maxCount, compact = false, requireSelf = true, pastePlaceholder = "You: Are we still on for Friday?\nThem: Yes — sorry, today got away from me.", extractScreenshots }: Props) {
  const imageInput = useRef<HTMLInputElement>(null);
  const exportInput = useRef<HTMLInputElement>(null);
  const archive = useRef<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<TranscriptCandidate[]>([]);
  const [processing, setProcessing] = useState(false);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => () => { archive.current = null; }, []);

  const patch = (next: Partial<ConversationDraft>) => onChange({ ...value, ...next });
  const parseText = (text: string, kind: "paste" | "chat_export", sourceName: string | null) => {
    try {
      const parsed = parseTranscript(text);
      patch({ method: kind, text, conversation: canonicalizeParsedConversation(parsed, kind, sourceName), selfParticipantId: parsed.participants.find((item) => item.is_self)?.id ?? null, screenshots: [] });
      setError(null);
    } catch (cause) {
      patch({ method: kind, text, conversation: null, selfParticipantId: null, screenshots: [] });
      setError(cause instanceof UnsupportedFormatError ? cause.message : "We couldn't read that conversation.");
    }
  };

  const readExport = async (file: File, entry?: string) => {
    setProcessing(true);
    setError(null);
    try {
      const result = await readChatFile(file, entry);
      if (result.kind === "choose") {
        archive.current = file;
        setCandidates(result.candidates);
        setNotices(result.warnings);
        return;
      }
      archive.current = null;
      setCandidates([]);
      setNotices(result.warnings);
      parseText(result.text, "chat_export", result.sourceName);
    } catch (cause) {
      setError(cause instanceof UnsupportedFileError ? cause.message : "We couldn't open that export. Use a supported TXT, CSV or WhatsApp ZIP.");
    } finally {
      setProcessing(false);
    }
  };

  const addScreenshots = async (files: File[]) => {
    const room = Math.max(0, maxScreenshots - value.screenshots.length);
    if (room === 0) return setError(`You can add up to ${maxScreenshots} screenshots.`);
    setProcessing(true);
    setError(null);
    const selected = files.slice(0, room);
    const settled = await Promise.allSettled(selected.map(prepareScreenshot));
    const ready = settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
    const failed = selected.filter((_, index) => settled[index].status === "rejected");
    const failure = settled.find((item) => item.status === "rejected") as PromiseRejectedResult | undefined;
    const screenshots = [...value.screenshots, ...ready];
    const total = screenshots.reduce((sum, item) => sum + item.compressedBytes, 0);
    if (total > SCREENSHOT_LIMITS.maxTotalBytes) {
      setError("Those screenshots exceed the 8 MB processed total. Remove some or upload a shorter exchange.");
    } else {
      patch({ method: "screenshots", screenshots, text: "", conversation: canonicalScreenshotConversation(screenshots.map((item) => item.name)), selfParticipantId: null });
      if (files.length > room) setError(`Only the first ${room} fit within the ${maxScreenshots}-screenshot limit.`);
      else if (failure) setError(failure.reason instanceof ScreenshotValidationError ? failure.reason.message : "One screenshot couldn't be read. Save it as PNG, JPG or WebP and retry.");
    }
    setFailedFiles(failed);
    setProcessing(false);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.screenshots.length) return;
    const screenshots = [...value.screenshots];
    [screenshots[index], screenshots[target]] = [screenshots[target], screenshots[index]];
    patch({ screenshots, conversation: canonicalScreenshotConversation(screenshots.map((item) => item.name)) });
  };

  const preview = value.conversation;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Conversation input type">
        {tabs.map((tab) => <Button key={tab.id} type="button" variant={value.method === tab.id ? "secondary" : "ghost"} className="min-h-11 px-2 text-xs sm:text-sm" role="tab" aria-selected={value.method === tab.id} onClick={() => patch({ method: tab.id })}>{tab.label}</Button>)}
      </div>

      {value.method === "screenshots" && <div>
        <input ref={imageInput} className="sr-only" type="file" accept={SCREENSHOT_ACCEPT} multiple onChange={(event) => { if (event.target.files) void addScreenshots(Array.from(event.target.files)); event.target.value = ""; }} />
        <button type="button" className={`${compact ? "min-h-24" : "min-h-36"} flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 text-center hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} onClick={() => imageInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addScreenshots(Array.from(event.dataTransfer.files)); }}>
          <ImagePlus className="h-5 w-5" /><span className="text-sm font-medium">Add screenshots</span><span className="text-xs text-muted-foreground">PNG, JPG or WebP · drag and drop on desktop</span>
        </button>
        {value.screenshots.length > 0 && <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.screenshots.map((shot, index) => <li key={shot.id} className="overflow-hidden rounded-lg border border-border bg-card">
            <img src={shot.dataUrl} alt={`Screenshot ${index + 1}: ${shot.name}`} className="aspect-[4/3] w-full object-cover" />
            <div className="flex min-h-11 items-center justify-between gap-1 p-1">
              <span className="pl-2 text-xs tabular-nums">{index + 1}</span>
              <div className="flex">
                <Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={index === 0} aria-label={`Move ${shot.name} earlier`} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={index === value.screenshots.length - 1} aria-label={`Move ${shot.name} later`} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-11 w-11" aria-label={`Remove ${shot.name}`} onClick={() => { const screenshots = value.screenshots.filter((item) => item.id !== shot.id); patch({ screenshots, conversation: screenshots.length ? canonicalScreenshotConversation(screenshots.map((item) => item.name)) : null }); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </li>)}
        </ol>}
        {failedFiles.length > 0 && <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void addScreenshots(failedFiles)}><RotateCw className="h-4 w-4" /> Retry failed files</Button>}
      </div>}

      {value.method === "chat_export" && <div>
        <input ref={exportInput} className="sr-only" type="file" accept={ACCEPT_EXPORT} onChange={(event) => { const file = event.target.files?.[0]; if (file) void readExport(file); event.target.value = ""; }} />
        <button type="button" className={`${compact ? "min-h-24" : "min-h-36"} flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 text-center hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} onClick={() => exportInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void readExport(file); }}>
          <FileText className="h-5 w-5" /><span className="text-sm font-medium">Add a chat export</span><span className="text-xs leading-relaxed text-muted-foreground">WhatsApp TXT or safe ZIP; defined TXT/CSV with sender, message and optional date fields</span>
        </button>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Apple and Android do not provide one universal chat-export format. Unsupported files can be added as screenshots or pasted text. No app installation is required.</p>
        {candidates.length > 0 && <div className="mt-3 rounded-lg border border-border p-3"><p className="text-sm font-medium">Choose one transcript</p><div className="mt-2 flex flex-wrap gap-2">{candidates.map((candidate) => <Button key={candidate.name} type="button" variant="outline" className="min-h-11" onClick={() => { const file = archive.current; if (file) void readExport(file, candidate.name); }}>{candidate.name}</Button>)}</div></div>}
      </div>}

      {value.method === "paste" && <div><label className="text-sm font-medium" htmlFor="shared-chat-paste">Paste messages</label><textarea id="shared-chat-paste" rows={compact ? 5 : 9} value={value.text} onChange={(event) => { const text = event.target.value; patch({ text, conversation: null, screenshots: [], selfParticipantId: null }); }} onBlur={() => { if (value.text.trim()) parseText(value.text, "paste", null); }} placeholder={pastePlaceholder} className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm leading-relaxed" /><Button type="button" variant="outline" className="mt-2 min-h-11" disabled={!value.text.trim()} onClick={() => parseText(value.text, "paste", null)}>Preview messages</Button></div>}

      {processing && <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite"><Loader2 className="h-4 w-4 animate-spin" /> Reading your files…</p>}
      {notices.length > 0 && <ul className="space-y-1 text-xs text-muted-foreground">{notices.map((notice) => <li key={notice}>{notice}</li>)}</ul>}
      {error && <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

      {preview && preview.format !== "screenshots_pending" && <section className="rounded-lg border border-border bg-muted/30 p-4" aria-label="Conversation preview">
        <h3 className="text-sm font-semibold">Conversation preview</h3>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><div><dt className="text-muted-foreground">Source</dt><dd>{preview.format.replaceAll("_", " ")}</dd></div><div><dt className="text-muted-foreground">People</dt><dd>{preview.participants.length}</dd></div><div><dt className="text-muted-foreground">Messages</dt><dd>{preview.messages.length.toLocaleString()}</dd></div><div><dt className="text-muted-foreground">Dates</dt><dd>{preview.dateRange.start ? `${preview.dateRange.start.slice(0, 10)} – ${preview.dateRange.end?.slice(0, 10)}` : "Not provided"}</dd></div></dl>
        {preview.ambiguousDates && <p className="mt-2 text-xs text-muted-foreground">Some dates can be read in more than one locale. Confirm the date order in the next step.</p>}
        <ol className="mt-3 max-h-44 space-y-2 overflow-auto border-t border-border pt-3">{preview.messages.slice(0, 8).map((message) => <li key={message.id} className="text-xs leading-relaxed"><span className="font-semibold">{message.raw_sender ?? "Sender unclear"}:</span> {message.content}</li>)}</ol>
        {requireSelf && <fieldset className="mt-4"><legend className="text-sm font-semibold">Which participant is you?</legend><div className="mt-2 grid gap-1">{preview.participants.map((person) => <label key={person.id} className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted"><input type="radio" name={`self-${preview.id}`} checked={value.selfParticipantId === person.id} onChange={() => patch({ selfParticipantId: person.id })} />{person.display_name}</label>)}</div></fieldset>}
      </section>}

      {value.method === "screenshots" && value.screenshots.length > 0 && requireSelf && <fieldset className="rounded-lg border border-border p-4"><legend className="px-1 text-sm font-semibold">Which side is you?</legend><p className="mb-2 text-xs text-muted-foreground">We will show the extracted messages for correction before analysis. This confirms the starting layout only.</p><div className="grid grid-cols-2 gap-2">{(["left", "right"] as const).map((side) => <Button key={side} type="button" variant={value.screenshotSelfSide === side ? "default" : "outline"} className="min-h-11" aria-pressed={value.screenshotSelfSide === side} onClick={() => patch({ screenshotSelfSide: side })}>{side === "left" ? "I am on the left" : "I am on the right"}</Button>)}</div></fieldset>}
      {value.method === "screenshots" && value.screenshots.length > 0 && value.screenshotSelfSide && extractScreenshots && <Button type="button" variant="outline" className="min-h-11 w-full" disabled={extracting} onClick={async () => { setExtracting(true); setError(null); try { const conversation = await extractScreenshots(value.screenshots, value.screenshotSelfSide); patch({ conversation, selfParticipantId: conversation.participants.find((person) => person.is_self)?.id ?? null }); } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn't preview those screenshots."); } finally { setExtracting(false); } }}>{extracting ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading screenshots…</> : "Preview extracted messages"}</Button>}
    </div>
  );
}
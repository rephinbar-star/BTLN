import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ClipboardPaste, FileText, ImagePlus, Loader2, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readChatFile, UnsupportedFileError } from "@/lib/ingest/file";
import { parseTranscript, UnsupportedFormatError } from "@/lib/ingest/parse";
import { canonicalizeParsedConversation, canonicalScreenshotConversation, type CanonicalConversation, type CanonicalSourceKind } from "@/lib/ingest/canonical";
import { prepareScreenshot, SCREENSHOT_ACCEPT, SCREENSHOT_LIMITS, ScreenshotValidationError, type PreparedScreenshot } from "@/lib/ingest/images";
import type { TranscriptCandidate } from "@/lib/ingest/archive";

export type ConversationDraft = {
  method: CanonicalSourceKind;
  text: string;
  importedText?: string;
  importSourceName?: string | null;
  screenshots: PreparedScreenshot[];
  conversation: CanonicalConversation | null;
  selfParticipantId: string | null;
  screenshotSelfSide: "left" | "right" | null;
  selfAbsent: boolean;
};
type Props = {
  value: ConversationDraft;
  onChange: (value: ConversationDraft) => void;
  maxScreenshots?: number;
  compact?: boolean;
  requireSelf?: boolean;
  pastePlaceholder?: string;
  allowScreenshots?: boolean;
  extractScreenshots?: (screenshots: PreparedScreenshot[], selfSide: "left" | "right") => Promise<CanonicalConversation>;
  screenshotMode?: "pair" | "group";
  accent?: "quick" | "deep" | "group";
  stage?: "input" | "review";
  onReview?: () => void;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  guidance?: string;
};
const ACCEPT_EXPORT = ".txt,.csv,text/plain,text/csv,.zip,application/zip,application/x-zip-compressed";
const tabs: { id: CanonicalSourceKind; label: string }[] = [
  { id: "screenshots", label: "Screenshots" }, { id: "chat_export", label: "Import" }, { id: "paste", label: "Paste text" },
];
const tone = {
  quick: { active: "bg-prism-violet/20 text-prism-lavender", border: "border-prism-violet/50", action: "bg-prism-violet text-primary-foreground" },
  deep: { active: "bg-prism-emerald/20 text-prism-emerald-text", border: "border-prism-emerald/50", action: "bg-prism-emerald text-background" },
  group: { active: "bg-prism-amber/20 text-prism-amber-text", border: "border-prism-amber/50", action: "bg-prism-amber text-background" },
} as const;
export const emptyConversationDraft = (): ConversationDraft => ({ method: "screenshots", text: "", screenshots: [], conversation: null, selfParticipantId: null, screenshotSelfSide: null, selfAbsent: false });

export function SharedConversationInput({ value, onChange, maxScreenshots = SCREENSHOT_LIMITS.maxCount, compact = false, requireSelf = true, pastePlaceholder = "You: Are we still on for Friday?\nThem: Yes — sorry, today got away from me.", extractScreenshots, screenshotMode = "pair", allowScreenshots = true, accent = "quick", stage, onReview, onBack, onNext, nextLabel = "Continue", guidance }: Props) {
  const imageInput = useRef<HTMLInputElement>(null);
  const exportInput = useRef<HTMLInputElement>(null);
  const archive = useRef<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<TranscriptCandidate[]>([]);
  const [processing, setProcessing] = useState(false);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [editingPreview, setEditingPreview] = useState(false);
  const [previewText, setPreviewText] = useState("");
  useEffect(() => () => { archive.current = null; }, []);
  const patch = (next: Partial<ConversationDraft>) => onChange({ ...value, ...next });
  const parseText = (text: string, kind: "paste" | "chat_export", sourceName: string | null) => {
    try {
      const parsed = parseTranscript(text);
      patch({ method: kind, ...(kind === "paste" ? { text } : { importedText: text, importSourceName: sourceName }), conversation: canonicalizeParsedConversation(parsed, kind, sourceName), selfParticipantId: null, screenshotSelfSide: null, selfAbsent: false });
      setError(null); onReview?.();
    } catch (cause) {
      patch({ method: kind, ...(kind === "paste" ? { text } : { importedText: text }), conversation: null, selfParticipantId: null, selfAbsent: false });
      setError(cause instanceof UnsupportedFormatError ? cause.message : "We couldn't read that conversation.");
    }
  };
  const readExport = async (file: File, entry?: string) => {
    setProcessing(true); setError(null);
    try {
      const result = await readChatFile(file, entry);
      if (result.kind === "choose") { archive.current = file; setCandidates(result.candidates); setNotices(result.warnings); return; }
      archive.current = null; setCandidates([]); setNotices(result.warnings);
      patch({ importedText: result.text, importSourceName: result.sourceName, conversation: null, selfParticipantId: null, selfAbsent: false });
    } catch (cause) { setError(cause instanceof UnsupportedFileError ? cause.message : "We couldn't open that export. Use a supported TXT, CSV or WhatsApp ZIP."); }
    finally { setProcessing(false); }
  };
  const addScreenshots = async (files: File[]) => {
    const room = Math.max(0, maxScreenshots - value.screenshots.length);
    if (room === 0) { setError(`You can add up to ${maxScreenshots} screenshots.`); return; }
    setProcessing(true); setError(null);
    const selected = files.slice(0, room);
    const settled = await Promise.allSettled(selected.map(prepareScreenshot));
    const ready = settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
    const failed = selected.filter((_, index) => settled[index].status === "rejected");
    const failure = settled.find((item) => item.status === "rejected") as PromiseRejectedResult | undefined;
    const screenshots = [...value.screenshots, ...ready];
    if (screenshots.reduce((sum, item) => sum + item.compressedBytes, 0) > SCREENSHOT_LIMITS.maxTotalBytes) setError("Those screenshots exceed the 8 MB processed total. Remove some or upload a shorter exchange.");
    else {
      patch({ method: "screenshots", screenshots, conversation: canonicalScreenshotConversation(screenshots.map((item) => item.name)), selfParticipantId: null, screenshotSelfSide: null, selfAbsent: false });
      if (files.length > room) setError(`Only the first ${room} fit within the ${maxScreenshots}-screenshot limit.`);
      else if (failure) setError(failure.reason instanceof ScreenshotValidationError ? failure.reason.message : "One screenshot couldn't be read. Save it as PNG, JPG or WebP and retry.");
    }
    setFailedFiles(failed); setProcessing(false);
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.screenshots.length) return;
    const screenshots = [...value.screenshots];
    [screenshots[index], screenshots[target]] = [screenshots[target], screenshots[index]];
    patch({ screenshots, conversation: canonicalScreenshotConversation(screenshots.map((item) => item.name)), selfParticipantId: null, screenshotSelfSide: null, selfAbsent: false });
  };
  const preview = value.conversation?.sourceKind === value.method && value.conversation.format !== "screenshots_pending" ? value.conversation : null;
  const reviewed = stage ? stage === "review" && Boolean(preview) : Boolean(preview) && !onReview;
  const review = async () => {
    if (value.method === "paste") return parseText(value.text, "paste", null);
    if (value.method === "chat_export") return parseText(value.importedText ?? "", "chat_export", value.importSourceName ?? null);
    if (!value.screenshots.length) return setError("Add at least one screenshot.");
    if (!value.screenshotSelfSide && !value.selfAbsent) return setError("Choose which side is you before reading screenshots. This is not your final identity confirmation.");
    if (!extractScreenshots) return setError("Screenshot reading isn't available here.");
    setProcessing(true); setError(null);
    try { const conversation = await extractScreenshots(value.screenshots, value.screenshotSelfSide ?? "right"); patch({ conversation, selfParticipantId: null, selfAbsent: false }); onReview?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn't preview those screenshots."); }
    finally { setProcessing(false); }
  };
  return <div className="space-y-4">
    {reviewed && preview ? <section aria-label="Conversation review" className="space-y-4">
      <Button type="button" variant="ghost" className="min-h-11 px-0" onClick={() => { setEditingPreview(false); onBack?.(); }}><ArrowLeft className="h-4 w-4" /> Change messages</Button>
      <h2 className="font-display text-[22px] font-bold">Look right?</h2>
      <p className="text-sm text-muted-foreground">Check the text and names before continuing. {preview.messages.length.toLocaleString()} messages · {preview.participants.length} people.</p>
      {preview.ambiguousDates && <p className="text-sm text-muted-foreground">Some dates can be read in more than one locale. Confirm date order before your read.</p>}
      <ol className="space-y-2" aria-label="Message sample">{preview.messages.slice(0, 3).map((message) => <li key={message.id} className="max-w-[90%] min-w-0 break-words rounded-xl border border-border bg-muted/40 px-3 py-2"><span className="block text-xs font-semibold">{message.raw_sender ?? "Sender unclear"}</span><span className="font-quote text-[15px] italic leading-[22px]">{message.content}</span></li>)}</ol>
      <details open={editingPreview} onToggle={(event) => setEditingPreview(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer content-center text-sm underline underline-offset-4">Edit messages</summary><label htmlFor={`transcript-correction-${preview.id}`} className="text-sm">Keep each sender's name; correct messages or order</label><textarea id={`transcript-correction-${preview.id}`} value={previewText || preview.messages.map((message) => `${message.raw_sender ?? "Unknown"}: ${message.content}`).join("\n")} onChange={(event) => setPreviewText(event.target.value)} rows={7} className="mt-2 w-full rounded-md border border-input bg-background p-3 text-base leading-relaxed"/><Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => { try { const corrected = canonicalizeParsedConversation(parseTranscript(previewText || preview.messages.map((m) => `${m.raw_sender ?? "Unknown"}: ${m.content}`).join("\n")), preview.sourceKind, preview.sourceName); corrected.warnings = [...preview.warnings, "Speaker or order corrections were supplied by the uploader."]; patch({ conversation: corrected, selfParticipantId: null, selfAbsent: false }); setPreviewText(""); setEditingPreview(false); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn't read those corrections."); } }}>Save corrections</Button><p className="mt-2 text-xs text-muted-foreground">Editing this text rebuilds the transcript. Original import dates may not carry through; return to the original import to restore them.</p></details>
      {requireSelf && <fieldset><legend className="mb-2 text-sm font-semibold">Which one are you?</legend><div className="grid gap-1">{preview.participants.map((person) => <label key={person.id} className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted"><input type="radio" name={`self-${preview.id}`} checked={!value.selfAbsent && value.selfParticipantId === person.id} onChange={() => patch({ selfParticipantId: person.id, selfAbsent: false })} />{person.display_name}</label>)}<label className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted"><input type="radio" name={`self-${preview.id}`} checked={value.selfAbsent} onChange={() => patch({ selfParticipantId: null, selfAbsent: true })} />I am not in this conversation</label></div></fieldset>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {onNext && <Button type="button" onClick={onNext} disabled={processing || (requireSelf && !value.selfAbsent && !value.selfParticipantId)} className={`min-h-12 w-full ${tone[accent].action}`}>{nextLabel} <ArrowRight className="h-4 w-4" /></Button>}
    </section> : <section aria-label="Add your messages" className="space-y-4">
      <h2 className="font-display text-[22px] font-bold">Add your messages</h2>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-background p-1" role="tablist" aria-label="Conversation input type">{tabs.filter((tab) => allowScreenshots || tab.id !== "screenshots").map((tab) => <Button key={tab.id} type="button" variant="ghost" className={`flex min-h-16 min-w-0 flex-col gap-1 whitespace-normal px-1 py-2 text-xs ${value.method === tab.id ? tone[accent].active : "text-muted-foreground"}`} role="tab" aria-selected={value.method === tab.id} onClick={() => { patch({ method: tab.id, selfParticipantId: null, screenshotSelfSide: null, selfAbsent: false }); setError(null); }}>{tab.id === "screenshots" ? <ImagePlus className="h-5 w-5" /> : tab.id === "chat_export" ? <FileText className="h-5 w-5" /> : <ClipboardPaste className="h-5 w-5" />}{tab.label}</Button>)}</div>
      {value.method === "screenshots" && <div><input ref={imageInput} className="sr-only" type="file" accept={SCREENSHOT_ACCEPT} multiple onChange={(event) => { if (event.target.files) void addScreenshots(Array.from(event.target.files)); event.target.value = ""; }} /><Button type="button" variant="outline" className={`flex h-auto min-h-32 w-full flex-col items-center justify-center gap-2 whitespace-normal rounded-lg border-2 border-dashed ${tone[accent].border} px-4 text-center`} onClick={() => imageInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addScreenshots(Array.from(event.dataTransfer.files)); }}><ImagePlus className="h-5 w-5" /><span className="text-sm font-semibold">Add screenshots</span><span className="text-xs text-muted-foreground">PNG, JPG or WebP · up to {maxScreenshots}</span></Button>{value.screenshots.length > 0 && <ol className="mt-3 grid gap-3 sm:grid-cols-2">{value.screenshots.map((shot, index) => <li key={shot.id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card"><img src={shot.dataUrl} alt={`Screenshot ${index + 1}: ${shot.name}`} className="aspect-[4/3] w-full object-cover" /><span className="block break-all px-2 pt-2 text-xs">{index + 1}. {shot.name}</span><div className="flex justify-end p-1"><Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={index === 0} aria-label={`Move ${shot.name} earlier`} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={index === value.screenshots.length - 1} aria-label={`Move ${shot.name} later`} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" className="h-11 w-11" aria-label={`Remove ${shot.name}`} onClick={() => { const screenshots = value.screenshots.filter((item) => item.id !== shot.id); patch({ screenshots, conversation: screenshots.length ? canonicalScreenshotConversation(screenshots.map((item) => item.name)) : null, selfParticipantId: null, screenshotSelfSide: null, selfAbsent: false }); }}><Trash2 className="h-4 w-4" /></Button></div></li>)}</ol>}{failedFiles.length > 0 && <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void addScreenshots(failedFiles)}><RotateCw className="h-4 w-4" /> Retry failed files</Button>}{value.screenshots.length > 0 && <fieldset className="mt-3"><legend className="text-sm font-semibold">Which side is you in these screenshots?</legend><p className="text-xs text-muted-foreground">This helps read the layout; you'll confirm the participant after extraction. {screenshotMode === "group" ? "Keep names visible for the other people." : ""}</p><div className="mt-2 flex flex-wrap gap-2">{(["left", "right"] as const).map((side) => <Button key={side} type="button" variant={value.screenshotSelfSide === side && !value.selfAbsent ? "secondary" : "outline"} className="min-h-11" aria-pressed={value.screenshotSelfSide === side && !value.selfAbsent} onClick={() => patch({ screenshotSelfSide: side, selfAbsent: false })}>I am on the {side}</Button>)}<Button type="button" variant={value.selfAbsent ? "secondary" : "outline"} className="min-h-11" aria-pressed={value.selfAbsent} onClick={() => patch({ screenshotSelfSide: null, selfParticipantId: null, selfAbsent: true })}>I'm not in the chat</Button></div></fieldset>}</div>}
      {value.method === "chat_export" && <div><input ref={exportInput} className="sr-only" type="file" accept={ACCEPT_EXPORT} onChange={(event) => { const file = event.target.files?.[0]; if (file) void readExport(file); event.target.value = ""; }} /><Button type="button" variant="outline" className={`flex h-auto min-h-32 w-full flex-col items-center justify-center gap-2 whitespace-normal rounded-lg border-2 border-dashed ${tone[accent].border} px-4 text-center`} onClick={() => exportInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void readExport(file); }}><FileText className="h-5 w-5" /><span className="text-sm font-semibold">Add a chat file</span><span className="text-xs text-muted-foreground">TXT, CSV or WhatsApp ZIP</span></Button>{value.importedText && <p className="mt-2 break-all text-sm text-muted-foreground">Ready: {value.importSourceName ?? "previous import"}</p>}{candidates.length > 0 && <div className="mt-3"><p className="text-sm">Choose one transcript</p>{candidates.map((candidate) => <Button key={candidate.name} type="button" variant="outline" className="mt-2 min-h-11" onClick={() => { const file = archive.current; if (file) void readExport(file, candidate.name); }}>{candidate.name}</Button>)}</div>}<details className="mt-2 text-sm text-muted-foreground"><summary className="min-h-11 cursor-pointer content-center">Which files work?</summary><p>WhatsApp TXT or safe ZIP and sender-attributed TXT/CSV. Apple and Android have no universal export; use screenshots or paste for unsupported files.</p></details></div>}
      {value.method === "paste" && <div><label htmlFor="shared-chat-paste" className="text-sm font-medium">Copy your conversation here</label><textarea id="shared-chat-paste" rows={compact ? 5 : 7} value={value.text} onChange={(event) => patch({ text: event.target.value, conversation: value.conversation?.sourceKind === "paste" ? null : value.conversation, selfParticipantId: null, selfAbsent: false })} placeholder={pastePlaceholder} className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-base leading-relaxed" /><p className="text-xs text-muted-foreground">Keep the names so we know who said what.</p></div>}
      {processing && <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading your files…</p>}{notices.length > 0 && <ul className="space-y-1 text-xs text-muted-foreground">{notices.map((notice) => <li key={notice}>{notice}</li>)}</ul>}{error && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</p>}
      {guidance && <p className="text-center text-sm text-muted-foreground">{guidance}</p>}
      <Button type="button" disabled={processing || (value.method === "paste" ? !value.text.trim() : value.method === "chat_export" ? !value.importedText : !value.screenshots.length || (!value.screenshotSelfSide && !value.selfAbsent))} onClick={() => void review()} className={`min-h-12 w-full ${tone[accent].action}`}>Review messages <ArrowRight className="h-4 w-4" /></Button>
      <p className="text-center text-xs text-muted-foreground">No signup to start.</p>
    </section>}
  </div>;
}

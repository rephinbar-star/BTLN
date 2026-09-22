import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearFeedback,
  listFeedbackForSource,
  submitFeedback,
  type SubmitFeedbackInput,
} from "@/lib/feedback/api";
import type {
  FeedbackRecord,
  FeedbackSourceKind,
  FeedbackTarget,
} from "@/lib/feedback/types";

type Ctx = {
  /** True for fictional examples: feedback stays local and never reaches the product loop. */
  demo: boolean;
  get: (targetKind: string, targetKey: string) => FeedbackRecord | undefined;
  save: (input: SubmitFeedbackInput) => Promise<{ ok: boolean; error?: string }>;
  clear: (target: FeedbackTarget) => Promise<{ ok: boolean; error?: string }>;
};

const FeedbackContext = createContext<Ctx | null>(null);

const keyOf = (kind: string, key: string) => `${kind}::${key}`;

export const FeedbackProvider = ({
  sourceKind,
  sourceId,
  demo = false,
  children,
}: {
  sourceKind: FeedbackSourceKind;
  sourceId: string | null | undefined;
  demo?: boolean;
  children: ReactNode;
}) => {
  const [records, setRecords] = useState<Record<string, FeedbackRecord>>({});
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (demo || !sourceId) return;
    const token = `${sourceKind}:${sourceId}`;
    if (loadedFor.current === token) return;
    loadedFor.current = token;
    let cancelled = false;
    void listFeedbackForSource(sourceKind, sourceId).then((rows) => {
      if (cancelled) return;
      const next: Record<string, FeedbackRecord> = {};
      rows.forEach((row) => {
        next[keyOf(row.targetKind, row.targetKey)] = row;
      });
      setRecords(next);
    });
    return () => {
      cancelled = true;
    };
  }, [sourceKind, sourceId, demo]);

  const save = useCallback<Ctx["save"]>(
    async (input) => {
      const k = keyOf(input.target.targetKind, input.target.targetKey ?? "main");
      setRecords((prev) => ({
        ...prev,
        [k]: {
          targetKind: input.target.targetKind,
          targetKey: input.target.targetKey ?? "main",
          rating: input.rating,
          reasonCodes: input.reasonCodes ?? [],
          comment: input.comment ?? null,
          outcome: input.outcome ?? prev[k]?.outcome ?? null,
        },
      }));
      return submitFeedback({ ...input, demo: demo || input.demo });
    },
    [demo],
  );

  const clear = useCallback<Ctx["clear"]>(
    async (target) => {
      const k = keyOf(target.targetKind, target.targetKey ?? "main");
      setRecords((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      return clearFeedback(target, demo);
    },
    [demo],
  );

  const value = useMemo<Ctx>(
    () => ({
      demo,
      get: (kind, key) => records[keyOf(kind, key)],
      save,
      clear,
    }),
    [demo, records, save, clear],
  );

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
};

export const useFeedbackStore = (): Ctx | null => useContext(FeedbackContext);

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("@/lib/session", () => ({ getSessionId: () => "s" }));
vi.mock("@/lib/ingest/extract", () => ({ extractScreenshotConversation: vi.fn() }));
vi.mock("@/components/ingest/SharedConversationInput", () => ({
  emptyConversationDraft: () => ({ method: "paste", text: "", screenshots: [], conversation: null, selfParticipantId: null, screenshotSelfSide: null, selfAbsent: false }),
  SharedConversationInput: ({ value, onChange }: any) => <textarea aria-label="conversation" value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} />,
}));
import { AdviceReviewNotice } from "./AdviceReviewNotice";

const recoverable = { withheld_count: 3, note: "Your analysis is complete. Some suggestions couldn't be checked, so we've left them out.", review: { status: "unavailable", recovery: "available", can_recover: true } };
const openAndType = () => {
  fireEvent.click(screen.getByRole("button", { name: "Resubmit to recover suggestions" }));
  fireEvent.change(screen.getByLabelText("conversation"), { target: { value: "Dev: hi\nJo: hello" } });
  fireEvent.click(screen.getByRole("button", { name: "Check suggestions" }));
};

describe("AdviceReviewNotice", () => {
  it("shows nothing when every item was checked and none held back", () => {
    const { container } = render(<AdviceReviewNotice integrity={{ withheld_count: 0, note: null, review: { status: "complete" } }} />);
    expect(container.textContent).toBe("");
  });
  it("older reports without a review field still show the held-back note", () => {
    render(<AdviceReviewNotice integrity={{ withheld_count: 1 }} />);
    expect(screen.getByRole("note").textContent).toMatch(/held back/);
  });
  it("legacy pending reports show the unchecked note and no retry button", () => {
    render(<AdviceReviewNotice integrity={{ withheld_count: 3, note: "still being checked", review: { status: "pending", can_retry: true } }} />);
    expect(screen.getByRole("note").textContent).toMatch(/couldn't be checked/);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("terminal state has no recovery button", () => {
    render(<AdviceReviewNotice integrity={{ withheld_count: 9, note: "couldn't be checked", review: { status: "unavailable", recovery: "unavailable", can_recover: false } }} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("explains why resubmission is needed and that it is free", () => {
    render(<AdviceReviewNotice integrity={recoverable} allowRecovery preview />);
    fireEvent.click(screen.getByRole("button", { name: "Resubmit to recover suggestions" }));
    expect(screen.getByText(/don't keep your conversation/)).toBeTruthy();
    expect(screen.getByText(/no charge, and no report credit/)).toBeTruthy();
  });
  it("preview mode never calls the server", () => {
    render(<AdviceReviewNotice integrity={recoverable} allowRecovery preview />);
    openAndType();
    expect(invoke).not.toHaveBeenCalled();
  });
  it("mismatch keeps the flow open and says the recovery wasn't used", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: false, reason: "input_mismatch" }, error: null });
    render(<AdviceReviewNotice integrity={recoverable} allowRecovery analysisId="a" />);
    openAndType();
    expect(await screen.findByText(/hasn't been used/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check suggestions" })).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith("advice-review", { body: { action: "recover", analysis_id: "a", session_id: "s", raw_text: "Dev: hi\nJo: hello" } });
  });
  it("used recovery closes the flow with a plain final message", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: false, reason: "recovery_used" }, error: null });
    render(<AdviceReviewNotice integrity={recoverable} allowRecovery analysisId="a" />);
    openAndType();
    expect(await screen.findByText(/already been used/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("success refreshes the report", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const onUpdated = vi.fn();
    render(<AdviceReviewNotice integrity={recoverable} allowRecovery analysisId="a" onUpdated={onUpdated} />);
    openAndType();
    await vi.waitFor(() => expect(onUpdated).toHaveBeenCalled());
  });
  it("locked or shared views never offer recovery", () => {
    render(<AdviceReviewNotice integrity={recoverable} />);
    expect(screen.queryByRole("button", { name: "Resubmit to recover suggestions" })).toBeNull();
    expect(screen.getByRole("note").textContent).toMatch(/couldn't be checked/);
  });
  it("recovery input offers Import and Paste only (no screenshots)", () => {
    render(<AdviceReviewNotice integrity={recoverable} allowRecovery preview />);
    fireEvent.click(screen.getByRole("button", { name: "Resubmit to recover suggestions" }));
    expect(screen.queryByRole("tab", { name: "Screenshots" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Import" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/screenshots can't be recovered/)).toBeTruthy();
  });
});

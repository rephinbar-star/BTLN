import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("@/lib/session", () => ({ getSessionId: () => "s" }));
import { AdviceReviewNotice } from "./AdviceReviewNotice";

const pending = { withheld_count: 3, note: "still being checked", review: { status: "pending", can_retry: true } };

describe("AdviceReviewNotice", () => {
  it("shows nothing when every item was checked and none held back", () => {
    const { container } = render(<AdviceReviewNotice integrity={{ withheld_count: 0, note: null, review: { status: "complete" } }} />);
    expect(container.textContent).toBe("");
  });
  it("older reports without a review field still show the held-back note", () => {
    render(<AdviceReviewNotice integrity={{ withheld_count: 1 }} />);
    expect(screen.getByRole("note").textContent).toMatch(/held back/);
  });
  it("terminal state has no retry button", () => {
    render(<AdviceReviewNotice integrity={{ withheld_count: 9, note: "couldn't finish", review: { status: "unavailable", can_retry: false } }} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("preview mode never calls the server", () => {
    render(<AdviceReviewNotice integrity={pending} preview />);
    fireEvent.click(screen.getByRole("button", { name: "Finish checking suggestions" }));
    expect(invoke).not.toHaveBeenCalled();
  });
  it("exhausted retry hides the button and explains plainly", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: false, reason: "attempts_exhausted" }, error: null });
    render(<AdviceReviewNotice integrity={pending} analysisId="a" />);
    fireEvent.click(screen.getByRole("button", { name: "Finish checking suggestions" }));
    expect(await screen.findByText(/stay hidden/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(invoke).toHaveBeenCalledWith("advice-review", { body: { action: "retry", analysis_id: "a", session_id: "s" } });
  });
  it("success refreshes the report", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const onUpdated = vi.fn();
    render(<AdviceReviewNotice integrity={pending} analysisId="a" onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole("button"));
    await vi.waitFor(() => expect(onUpdated).toHaveBeenCalled());
  });
});

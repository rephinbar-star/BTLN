/**
 * Polling policy for a Group Read result page.
 *
 * Pulled out of the component so the "a finished read must never flip to the
 * failure screen, however long the tab stays open" rule is deterministically
 * testable with simulated time.
 */

export const GROUP_POLL_MS = 2500;
export const GROUP_TIMEOUT_MS = 180_000;

export type PollAction = "poll" | "stop" | "timeout";

/** What the interval should do on this tick. */
export function pollAction(
  status: string | undefined,
  elapsedMs: number,
  timeoutMs: number = GROUP_TIMEOUT_MS,
): PollAction {
  // Terminal states stop the poll for good — including long after the timeout
  // window has passed.
  if (status === "complete" || status === "failed") return "stop";
  if (elapsedMs > timeoutMs) return "timeout";
  return "poll";
}

/** Whether the "that didn't finish" screen should be shown. */
export function showsFailureScreen(status: string | undefined, timedOut: boolean): boolean {
  if (status === "complete") return false;
  return status === "failed" || timedOut;
}

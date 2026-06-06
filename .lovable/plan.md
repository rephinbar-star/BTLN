## 1. Fix the persistent "Payment successful — unlocking your full report…" toast

**File:** `src/pages/Report.tsx`

The loading toast is created with a generated id in one effect, but the success effect (that runs once entitlement flips) calls `toast.success(...)` without dismissing the loading toast — so the spinner banner stays on screen.

Fix:
- Use a stable toast id constant (e.g. `"checkout-unlock"`) for the loading toast.
- In the success effect, replace the loading toast by reusing the same id: `toast.success("Unlocked. Enjoy your full report.", { id: "checkout-unlock", duration: 3000 })`.
- Also clear the polling interval and dismiss the toast on unmount / when checkout param is removed, so it can't linger if the user navigates.

## 2. Move "Invite friends" below "Start a new analysis"

**File:** `src/components/chemistry/FinalCta.tsx`

Currently the orange "Invite friends" button renders above "Start a new analysis". Swap the order so the layout becomes:

1. Start a new analysis (primary dark button)
2. Invite friends (orange animated button)

Keep all existing styling (size, color, animation, hover) intact — only the DOM order changes, and remove the `-top-[20px]` offset on the orange button since it's no longer the top element (replace with normal `mt-3` spacing for visual balance).

No other files affected.
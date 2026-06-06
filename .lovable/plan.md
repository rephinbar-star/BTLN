## Plan

1. **Fix the backend subscription write failure**
   - Add/repair the database uniqueness needed for subscription upserts so successful subscription webhook events can save the user’s membership row instead of failing.
   - Keep the existing entitlement function working so active monthly/annual subscriptions unlock reports.

2. **Make webhook handling more robust**
   - Update the payments webhook to upsert subscriptions using a conflict target that matches the actual table constraints.
   - Ensure subscription purchases tied to a report also mark that report as paid/unlocked when the checkout completes or when the subscription event arrives.

3. **Stop the stuck toast / paywall loop**
   - Improve the report checkout-success polling so it checks both entitlement and the report row after checkout.
   - If the webhook is still delayed, keep the user on the report with a clear “still syncing” message instead of sending them back into checkout.
   - Dismiss/replace the “Payment successful — unlocking…” toast reliably once access is detected or the URL state is cleared.

4. **Verify with live backend signals**
   - Re-check the affected user/report rows after the migration/function change.
   - Confirm the webhook no longer logs the `ON CONFLICT` error and the report unlocks for the subscribed user.
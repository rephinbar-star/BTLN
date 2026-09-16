# Refund decision sheet (PRIVATE — not published, not legal advice)

Status: decision pending with owner. Nothing in this file is on the public site.
No refunds have been issued; no policy text has been changed as a result of this sheet.
Support address (approved, already live): btlines.info@gmail.com.

## 0. What is already true today (verified in code, 2026-09-16)
- Public Terms says refunds are handled **case by case** via the support address. It promises no automatic right and no fixed window.
- **Cancellation** is implemented: `cancel-subscription` sets cancel-at-period-end in Stripe. Access continues to the paid-through date; no money moves.
- **Refunds are not implemented in the product.** There is no refund button and no webhook handler that revokes entitlement on `charge.refunded` or `charge.dispute.created`. A refund issued in the Stripe dashboard today would return money but would **not** remove access.
- One-time unlocks are permanent rows (`analyses.is_paid`, `group_read_unlocks`); subscriptions are `user_subscriptions` rows driven by Stripe events.

Refund handling and cancellation are separate mechanisms and should stay separate in copy and in code.

## 1. Options for the subscription refund policy

**Option A — Case by case (status quo).**
Keep current wording; handle each request by email at discretion.
+ Maximum flexibility, zero engineering, no promise that can be broken.
− Slow, inconsistent, weak as a conversion signal; unclear to buyers; in the EU/UK a consumer's statutory withdrawal right may still apply regardless of what the page says.

**Option B — 14-day no-questions refund on the first subscription payment only.**
Renewals not refundable; cancellation remains the route for future periods.
+ Clear and common; aligns with EU/UK 14-day distance-selling expectations; strongest conversion effect of the three.
− Some refunds after full use of the service; needs an entitlement-revocation path.

**Option C — Pro-rata refund on request for the unused part of the current period.**
+ Feels fair for annual buyers who leave in month two.
− Most support and accounting work; awkward for one-time reports; needs proration rules written down.

**Recommendation:** Option B for subscriptions, plus the one-time rule in §2.
It is the cheapest to explain, the easiest to honour consistently, and it is closest to the statutory position the owner is likely subject to anyway. Option A remains the honest fallback while volume is tiny; it is what is published today and does not need to change before a private beta.

## 2. One-time reports ($4.99 single report / one-time Group Read unlock)

Proposed rule (owner to accept or reject):
- **Not yet generated / generation failed** → full refund, unlock removed.
- **Generated and viewed** → no automatic refund; discretionary goodwill refund, and if granted the unlock is removed.
- **Duplicate or mis-targeted purchase** (paid for the wrong report) → full refund or move the unlock to the intended report, at the buyer's choice.

Rationale: the deliverable is produced and consumed instantly, so an unconditional window would effectively make paid reports free.

## 3. Entitlement semantics to implement once a policy is chosen

| Event | Money | Subscription access | One-time unlock |
|---|---|---|---|
| Cancellation (cancel-at-period-end) | none | keeps access to paid-through date, then lapses | unaffected (permanent) |
| **Full refund** of a subscription invoice | returned | end access immediately (set status `canceled`, period end = now) and also cancel the subscription in Stripe so it does not renew | n/a |
| **Partial refund** of a subscription invoice | partial | keep access to the paid-through date; record the refund. Do **not** silently shorten access unless the refund was explicitly agreed as "refund the remaining months", in which case end access on the agreed date | n/a |
| Full refund of a one-time report | returned | n/a | revoke that specific unlock; existing share links for that report must fail closed |
| Partial refund of a one-time report | partial | n/a | keep the unlock (partial = goodwill discount, not a return) |
| **Dispute opened** (`charge.dispute.created`) | held | suspend access pending outcome, do not delete data | suspend that unlock |
| Dispute won by us | retained | restore access | restore unlock |
| Dispute lost | lost | end access immediately, block future purchases from that customer at the owner's discretion | revoke unlock |

Engineering work implied (not yet built, sized small): handle `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed` in `payments-webhook`; add a `refunds` audit trail; make unlock revocation fail closed for share tokens. **Do not build this until the policy is chosen** — the handlers encode the policy.

## 4. Support handling (once a policy exists)
1. Request arrives at btlines.info@gmail.com.
2. Identify the customer by the email used at checkout; never by an account claim alone.
3. Classify: subscription vs one-time; within window vs outside; generated vs not.
4. Issue the refund in Stripe (test mode until launch); record date, amount, reason, and decision in a private log.
5. Reply with the outcome and the resulting access state, in plain language.
6. If declining, say why and offer the alternative (cancel so it does not renew; access continues until the paid-through date).

Target: respond within 3 business days. This is an internal target, not a published promise.

## 5. Explicitly out of scope here (no primary verification available)
- Statutory withdrawal rights and their exact application — depends on the legal entity and country, which the owner has not yet supplied. No legal claims are made in this sheet or on the site.
- Chargeback fees and Stripe's dispute mechanics beyond the entitlement effects above.

## 6. Open owner decisions
1. Option A, B, or C for subscriptions?
2. Accept, amend, or reject the one-time rules in §2?
3. Accept the entitlement table in §3 as the spec for the refund/dispute webhook handlers?
4. Should a chosen policy be published in Terms before the private beta, or stay "case by case" until launch?

# Private beta plan — READY, NOT RUN (PRIVATE)

Status: **ready to run**. No invitations have been sent, no participants recruited, no outreach of
any kind. Genuine participants are owner-supplied. Nothing from a beta may appear on the public site
without written permission plus admin approval (the existing testimonial pipeline enforces both).

Size: 5–10 participants. Duration: one week. Frontend stays unpublished; participants use the
preview URL.

## Scope of a session (about 25 minutes)
1. **Quick Take** — participant runs one Quick Take. Default is the fictional sample text provided
   in the script; using their own conversation is voluntary and never requested twice.
2. **One import** — either a Deep Read (two-person export) or a Group Read (3–15 people), their
   choice. Synthetic export files are provided.
3. **Result usefulness** — three questions, answered out loud or in the form.
4. **Sharing privacy** — participant creates a share link, opens it in a private window, sees the
   redacted/pseudonymous version, then revokes it and confirms it fails closed.
5. **Feedback with consent** — participant submits feedback in the app. Publication consent is a
   separate, unticked box.
6. **Payment test** — test-mode checkout with card 4242 4242 4242 4242 only. Participants are told
   before they start that no real money can be charged and that they must not enter a real card.

## Moderator script (read aloud, do not paraphrase the privacy parts)
- "This is an unreleased product. You do not have to use a real conversation. A made-up example is
  loaded by default and it works exactly the same."
- "If you do choose your own chat: it is your copy of the conversation, the other people in it have
  not agreed to this, and you should not share the result with them without asking."
- "We do not record your screen and we do not collect the content of any chat you use."
- "Payments are in test mode. Use only the test card I give you. Never type a real card number."
- "At the end, there is a feedback box. Anything you write is private unless you tick the box that
  says we may publish it, and even then we would come back to you before anything goes public."
- "Tell me the moment anything is confusing. Confusion is the finding."

## Questions asked (verbatim)
1. In one sentence, what did the report tell you?
2. Was anything in it wrong, or stated more confidently than the messages support?
3. Would you send this to the other person? Why or why not?
4. Before you shared it: what did you expect the other person would be able to see?
5. What would make you pay for this? What would stop you?

## Metrics (all measured at the session, none from chat content)
Analytics events already in the product carry no message text, no names, and no file contents. No new
event that could capture personal content is added for the beta.

| Metric | Definition | Target |
|---|---|---|
| Activation | participant reaches a completed Quick Take result | 9 of 10 |
| Import completion | started import → report rendered, without moderator help | 7 of 10 |
| Time to first result | click to rendered Quick Take | under 90 s median |
| Time to import result | upload to rendered Deep/Group report | under 5 min median |
| Share comprehension | participant's answer to Q4 matches what the share link actually shows | 8 of 10 |
| Revocation verified | revoked link confirmed dead by the participant | 10 of 10 |
| Payment test completion | test checkout completes and entitlement appears on /account | 5 of 5 who attempt it |
| Consent rate | share of feedback entries with publication consent ticked | recorded, no target |

Failures are recorded as written notes, not scores. No usage counter, participant count, or quote
from a beta goes on the public site.

## Materials checklist
- [x] Fictional Quick Take sample text (already on /sample)
- [x] Synthetic two-person export file and synthetic group export file (used by the existing E2E fixtures)
- [x] Test card and test-mode banner already visible in the preview
- [x] In-app feedback with separate publication-consent checkbox and admin moderation
- [x] Share link creation and revocation available in the product
- [ ] Participant list — owner-supplied, not started
- [ ] Session times — owner-scheduled, not started

## Rules
- No outreach, no recruiting, no incentives promised by the assistant.
- No fabricated participants, quotes, counts, or screenshots.
- Real conversations are voluntary and never retained beyond what the product already stores.
- If a participant asks for their data to be removed, delete the report and, if asked, the account.

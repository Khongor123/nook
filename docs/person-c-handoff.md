# Person C: demo reliability handoff

Audited against all three pages of the Person C AI Planning Demo PDF and updated
main `e685415` (PRs #1–#3 merged). Work branch: `c-demo-reliability`.
Only AI/planning code and this handoff are changed. A owns routes, persistence,
Canvas, auth, configuration, and merging; B2 owns the phone screens.

## PDF task audit

| PDF task | Evidence / status |
| --- | --- |
| Clone, branch, install, shared types and fixture, timeZone | Done before this pass; current main contains the required types and fixtures. |
| Four required AI/planning files and three output contracts | Done; contracts preserved in this PR. |
| Fictional Friday 5 p.m., 2–3 hour example and Tuesday cue | Done in `src/lib/planning/demo-example.ts`; sample outputs below. |
| Start-by: no due, overdue, tomorrow, estimate change, timezone, due date unchanged | Done; calendar-day and DST tests pass. No new scheduling rule was needed. |
| Latest checkpoint, same-assignment Idea, exclude Reflections, fallback next step | Done; A selects latest checkpoint in private detail GET; C filters Ideas and steps. Fixed empty-plan checkpoint case. |
| No checkpoint, empty checkpoint, all steps done | Done and tested. An empty plan no longer means all work is finished. |
| Zod validation, 1–6 editable steps, positive minutes, valid effort range | Done; unchanged contract matches A's plan-save route. |
| Sanitized title/instructions only, caps, grounded suggestions, prompt injection treated as data | Boundary and prompt verified offline. Model's semantic grounding still needs live human review. |
| Server-only provider integration | Done: Groq Responses API via OpenAI SDK, with OpenAI alternative retained. This intentionally follows merged main rather than reverting to OpenAI-only PDF instructions. |
| Missing/refused/incomplete/invalid AI response and outage → manual plan | Done; real SDK with fake transport covers refusal, malformed output, 401/429/5xx and timeout/network errors. No automatic retries. |
| Clear instructions → steps; vague instructions → review | Clear/vague fictional responses tested offline. Generic “Do the assignment” deterministically falls back. Any model draft marked needsReview is replaced with one instruction-checking step. Other ambiguity still needs live evaluation. |
| Every step/estimate editable; generated draft separate from saved edits | Returned copies are editable and tested. A's POST breakdown only reads; PUT plan saves reviewed edits transactionally. Browser/database reload verification remains pending. |
| Cache by assignment/source hash/prompt version | Done, user-scoped, 100-entry process-local cache; no durable cross-restart cache. Save reviewed plans before the demo. |
| Focused tests | Done; `npm test` includes C's tests and A's private-planning tests. |
| Fixture: clear due/instructions, Idea, Reflection, two complete steps, checkpoint | Done in `demo-example.ts`; preserved rather than rebuilt. |
| Sample success/failure JSON and agreed wording for B2 | Done below and as typed exported examples. B2 acknowledgement/rendering still needs verification. |
| Full phone return-loop rehearsal and fallback rehearsal with B | Needs verification with B2 on the integrated phone UI and signed-in demo account. No claim of completed phone rehearsal. |
| Final handoff, known gaps, commit/push/PR | Original PR #2 merged; this follow-up adds reliability tests, updated examples, and the script below. A reviews and merges. |

## Contracts already integrated by A

- `GET /api/private/shelf` returns start-by fields from C's rule using the saved
  effort-range midpoint. Upcoming work without an estimate says `needs_plan`.
- `POST /api/private/assignments/:id/breakdown` returns an unsaved editable draft.
- `PUT /api/private/assignments/:id/plan` saves reviewed steps and effort. Include
  existing step IDs when editing; keep the student's completion state.
- `GET /api/private/assignments/:id` returns `welcomeBack`, the latest checkpoint,
  saved thoughts, and ordered steps. There is no separate welcome-back endpoint.
- POST `.../thoughts` saves explicit `idea` or `reflection`; POST `.../checkpoints`
  saves `{ note, nextStep }`. These routes insert notes/checkpoints, not steps.

Source review: A's plan-save SQL updates effort and steps, never `due_at`.
The breakdown route sends no dates, notes, thoughts, or checkpoints to AI.
These are code-review findings, not a substitute for authenticated persistence tests.

## Exact fictional examples for B2

Import from `src/lib/planning/demo-example.ts`:
`exampleAssignment`, `exampleDraft`, `exampleSteps`, `exampleThoughts`,
`exampleCheckpoint`, `exampleStartBy`, `exampleWelcomeBack`,
`vagueExampleAssignment`, `exampleReviewDraft`, `exampleManualFallback`.
All drafts here are hand-authored fixtures, not live provider recordings.
Do not label them “live AI”. The demo fixture IDs are strings for layout work;
private routes require real UUIDs from A's fictional seed/signed-in database.

History essay instructions: “Choose a local historical event. Write a 900-word
essay using two course readings. Revise and submit a PDF.” Due Friday,
November 13, 2026, 5 p.m., America/New_York (`2026-11-13T22:00:00Z`).
Fixed example clock: November 7, 2026, 10 a.m. in the same zone.

Success draft (`exampleDraft`):

```json
{
  "steps": [
    { "text": "Read the instructions and choose an event", "minutes": 20 },
    { "text": "Outline using two course readings", "minutes": 30 },
    { "text": "Draft the essay", "minutes": 70 },
    { "text": "Revise and prepare a PDF", "minutes": 30 }
  ],
  "effortMinMinutes": 120,
  "effortMaxMinutes": 180,
  "needsReview": false,
  "note": "Fictional demo plan, not a live AI response. Review and edit the suggestions."
}
```

Start-by: midpoint 150 minutes → ceil(150/90) = 2 workdays + 1 buffer day.
Tuesday November 10 at 5 p.m. is a suggestion; Friday remains Canvas's due date.

```json
{
  "startByAt": "2026-11-10T22:00:00Z",
  "reason": "Suggested from about 150 minutes of work at 90 minutes a day, plus one buffer day. Change the estimate anytime.",
  "state": "suggested"
}
```

First two example steps are complete. Checkpoint: “Outline finished; ready to
 draft.” Next step: “Write the opening paragraph.” Idea: “Open with a question?”
Reflection: “I feel overwhelmed”. Welcome-back output:

```json
{
  "message": "You left off: Outline finished; ready to draft.",
  "nextAction": "Write the opening paragraph.",
  "ideaText": "Open with a question?"
}
```

Vague instructions: “Prepare something about history for class.” Example review
response (10–20 minutes is only for checking instructions, not the unknown assignment):

```json
{
  "steps": [{ "text": "Open Canvas and check the full instructions", "minutes": 10 }],
  "effortMinMinutes": 10,
  "effortMaxMinutes": 20,
  "needsReview": true,
  "note": "Review the Canvas prompt before planning. This estimate is only for checking the instructions."
}
```

Generic “Do the assignment”, blank instructions, unconfigured AI, refusal, outage,
or invalid output return the same stable manual fallback:

```json
{ "steps": [], "needsReview": true, "note": "Make a manual plan" }
```

### Exact UI wording and behavior

- Label every AI draft **“Suggested plan · editable”** even when `needsReview` is false.
- When `needsReview` is true, show **“Review needed”** and `note` next to the draft.
- No steps: **“AI draft unavailable. Make a manual plan.”** Keep existing edits,
  offer **“Add a step”**, and keep saving available once there is a valid plan.
- Truncated prompt: show the returned **“Only part of the instructions was used.
  Review the full Canvas prompt before saving.”** warning.
- Keep **“Canvas due”** and **“Suggested start”** separate. Explain the fixed
  90-minute/day assumption and capped workdays if asked.
- Display the Idea as a separate note. Do not convert it or a Reflection into a task.
- Save only on **“Save reviewed plan”**. Do not auto-save a generated response or
  silently overwrite existing typed work. Keep fields on save failure.
- After saving, reload shelf/detail; after browser reload, verify saved edits,
  completed steps, checkpoint, and thoughts remain attached to the same assignment.

## AI quality and failure changes

The prompt now explicitly forbids inventing topics, word counts, source counts,
file formats, and submission steps absent from the input. Exact generic prompts
fall back without a request; short specific prompts such as “Read chapter 3”
still reach the model. This is not a general-purpose ambiguity classifier.
Truncation forces `needsReview` and a clear warning. A mixed refusal plus parsed
text is rejected. Empty review notes get useful wording. Cache keys include the
prompt version and truncation state, and returned drafts remain independent copies.

Welcome-back now distinguishes a missing plan from a completed plan: if no steps
exist, a saved checkpoint nextStep survives. If actual same-assignment steps all
have `done: true`, return “Review and submit when ready”. No checkpoint invites
opening the assignment. Blank/invalid-dated Ideas are ignored; Reflections never
participate in action selection.

## How to verify

```bash
npm test
npm run lint
npx tsc --noEmit
```

Unit/provider tests use the real SDK with fake HTTP responses: **no network calls**.
The fictional JSON round-trip test checks data contracts, not database persistence.
The baseline on main had 13 passing tests; this branch adds provider and demo-loop
coverage. No Next.js pages, routes, config, package files, or database files changed.

Opt-in live check (fixed fictional inputs only; never reads the database):

```bash
node --conditions=react-server --import tsx src/lib/ai/live-check.ts
```

A configures `GROQ_API_KEY` in ignored `.env.local`; optional `GROQ_MODEL` overrides
`openai/gpt-oss-20b`. Groq takes precedence over OpenAI. OpenAI's alternative still
uses `OPENAI_API_KEY` + `OPENAI_MODEL`. The live-check script loads local env without
printing values, skips clearly if Groq is absent, and makes at most two actual
requests (two clear assignments); the known vague and generic inputs are handled locally. Only safe category codes, counts, and timings are logged; raw responses are not logged. Human review must check that no new requirements were invented.
A passed schema test is not proof of semantic accuracy. Keep the manual path ready.

This checkout has no `.env.local` or provider key. Live-check was run and reported
**SKIPPED**; actual Groq generation and response quality remain unverified here.
Do not copy a teammate's secrets or real student coursework into tests or Git.

## A-owned follow-up (do not edit from this branch)

`src/app/dev/planning/tester.tsx`: the draft handler reads `needsReview` but never
renders that flag. Code-inspected reproduction: return a valid draft with
`needsReview: true` and a neutral note such as “Check these steps before saving.”
from the breakdown route; generate it in `/dev/planning`. The message is only
“Editable draft ready” plus the note, without a distinct review warning. Expected:
render **“Review needed”** when the flag is true, in addition to `note`. B2 should
carry that behavior into the phone UI. This has not been browser-reproduced here.
This file is intentionally untouched; the PR reports this follow-up to A.

## Three-minute fictional demo script

| Time | Action and wording |
| --- | --- |
| 0:00–0:25 | Open the fictional History essay on the phone. “Nook makes a large assignment into a small start. This is invented coursework.” |
| 0:25–0:55 | Generate a live draft if verified; otherwise load the labeled fixture/manual path. “These steps and minutes are suggestions. I can edit every one.” Edit one step and save. |
| 0:55–1:20 | Set the reviewed estimate to 120–180 minutes. “The midpoint is 150 minutes: two workdays plus one buffer day. Friday at five gets a Tuesday suggestion. Canvas's due date stays Friday.” Change effort and point out the changed suggestion. |
| 1:20–1:50 | Save “Open with a question?” as Idea and “I feel overwhelmed” as Reflection. “Both stay with this assignment; neither automatically becomes a task.” |
| 1:50–2:15 | Mark two steps complete. Save “Outline finished; ready to draft” and nextStep “Write the opening paragraph.” |
| 2:15–2:45 | Reload, reopen the same assignment, show saved edits and welcome-back. “Here's where I stopped, my saved idea, and the next step I chose.” |
| 2:45–3:00 | Show manual planning or explain the backup. “If AI is unavailable, I can still make and save my plan. A nudge, not a score.” |

The fixed fixture's Tuesday cue is reproducible only at its fixed example clock.
For a later live demo, A must supply a future fictional Friday due date and use
actual current time. Never change a real Canvas due date to make the story fit.
At 360/390/430 px, verify no horizontal overflow, 44 px touch controls, keyboard-open
Save access, explicit loading/retry messages, and the full reload/return loop.
Rehearse once with the provider available and once with manual planning. That
phone/browser/Supabase rehearsal remains a team verification task, not completed here.

Provider protocol reference: https://console.groq.com/docs/responses-api


## Follow-up: live failure diagnostics and vague-output guard

Branch `c-live-ai-diagnostics` adds opt-in diagnostics without changing the public
API result. Normal API calls still return only a draft or the same manual fallback
and do not log anything. `createBreakDown` accepts an optional observer receiving
only fixed category codes. Exception messages, response bodies/headers, request
IDs, source text, environment values, and raw model text are never forwarded.
A broken observer cannot affect planning.

The live checker now runs all cases before reporting failure and does not
silently retry. It logs only the fixed case label, elapsed time, diagnostic codes,
step count, review flag, safe quality findings, and pass/fail. Codes distinguish
`timeout`, `network`, `authentication`, `rate_limited`, `provider_error`,
`invalid_json`, `invalid_output`, `refused`, `incomplete`, and `not_configured`.
A manual fallback on a clear input fails the check; a later explicit rerun is a
separate result and does not erase the earlier failure. A real SDK timeout remains
bounded at 20 seconds, with no automatic SDK retries.

Known vague preparation prompts are locally reduced to exactly:

```json
{
  "steps": [{ "text": "Open Canvas and check the full instructions", "minutes": 10 }],
  "effortMinMinutes": 10,
  "effortMaxMinutes": 20,
  "needsReview": true,
  "note": "Review the Canvas prompt before planning. This estimate is only for checking the instructions."
}
```

Any model draft marked `needsReview` gets this same replacement, so model-added
research, sources, deliverables, or submission instructions cannot survive in
that review-only response. Truncated input also gets only the checking step,
with its existing truncation warning. Empty/generic instructions and actual
provider failures retain the empty-step manual fallback. Unknown ambiguity still
relies on the provider flag; this is not a universal semantic classifier.

Clear fictional cases cover (1) the essay, which explicitly supplies two course
readings and PDF submission but no submission destination; (2) a chapter summary
with no research sources or submission requirement. Checker-only heuristics flag
unsupported source qualifiers/counts, external research, citation style, file
format, submission action/destination, and step-total/effort-range mismatches.
Supplying two course readings does not authorize three scholarly sources;
“submit a PDF” does not authorize DOCX or a named platform. These checks can have
false positives/negatives and do not prove factual grounding. They flag results
for review, rather than rewriting a student's assignment or enforcing new API
validation rules. The real provider's semantic quality remains a live review task.

All regression tests use fictional data and dummy test markers. This checkout
still has no Groq key: the opt-in checker reports SKIPPED here. No live output was
reviewed or claimed verified in this follow-up. A/C can run the command above in
their configured checkout and share only the safe summary for diagnosis.

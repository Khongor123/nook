# Person C final demo handoff

Base: current main `907630a`. PR #6 (Groq diagnostics, one schema retry, vague
review-only behavior) and PR #7 (A's Canvas metadata/sync work) are merged.
Follow-up branch: `c-demo-handoff-final`. No API, Canvas, Supabase, deployment,
package, or shared-type files are changed by this follow-up.

Read all three pages of the original Person C AI Planning Demo PDF before this
pass. The three functions, schemas, editable result contract, date rule, fixtures,
Reflection exclusion, and focused tests were already implemented; they were not
rebuilt. This pass verifies current main, captures live evidence and a real backup,
and makes the remaining demo handoff explicit.

## Configuration on this machine

Create/edit `/Users/bolderdene/nook/.env.local` at the repository root:

```dotenv
GROQ_API_KEY=....
```

The user enters the actual value locally. Never paste it into chat, print it,
commit it, or copy A's full environment file/Canvas credential. `GROQ_MODEL` is
optional: the merged default is `openai/gpt-oss-20b`. No Canvas credential is needed
for the fixed-input checker. Live calls in this pass started only after the user
confirmed configuration. Keys and real coursework were not read into logs or Git.

```bash
node --conditions=react-server --import tsx src/lib/ai/live-check.ts
```

The checker sends only its fixed fictional title/instructions, never database
rows, thoughts, checkpoints, due dates, user IDs or credentials as model input.
Logs contain only fixed case labels, safe diagnostic categories, counts, timings,
quality flags and pass/fail. Raw provider errors, headers and model text are not
logged. Human review of a captured fictional draft is separate from those logs.

## Actual verification in this pass

Before editing, updated main passed **45 tests**, `npm run lint`, and
`npx tsc --noEmit`.
The final branch passes **49 tests**, lint, TypeScript, and `git diff --check`.
All ten changed/new files were checked against the allowed AI/planning/handoff
paths before committing. No real coursework or credentials are included.

Live runs below were authorized, using the configured Groq provider. A checker's
PASS is a schema/heuristic result, not proof of complete factual grounding.

| Case | Main baseline | Retry-observed/capture run | After grounding prompt fix |
| --- | --- | --- | --- |
| clear essay | success, PASS, 6 steps, 1182 ms | success, heuristic PASS, 6 steps, 869 ms; human review rejected added outside research | review_only, FAIL for a clear task, 1 checking step, 1602 ms |
| clear summary, no sources/submission specified | success, PASS, 5 steps, 1725 ms | success, PASS, 5 steps, 993 ms | success, PASS, 3 steps, 700 ms |
| vague preparation | review_only, PASS, 1 step, 0 ms | review_only, PASS, 1 step, 2 ms | review_only, PASS, 1 step, 1 ms |
| generic assignment | manual_input, PASS, 0 steps, 1 ms | manual_input, PASS, 0 steps, 0 ms | manual_input, PASS, 0 steps, 0 ms |

The last live run **failed overall** because the clear essay was overcautiously
marked for review. Its safe behavior is usable, but full live-essay quality is
not signed off. Earlier passing runs are not erased or promoted to a guarantee.
The summary was checked by heuristics; its raw generated draft was not retained
for separate human review in this pass.

No live schema rejection occurred in these runs. Consequently, **the retry was
not observed against Groq**. It is verified with the real SDK and fake transport:
first `400/json_validate_failed` then success → exactly two calls; two schema
rejections → two calls and the existing manual fallback; 401, 429, refusals and
unrelated 400s → one call. A failure on the second attempt never makes a third.

The added fixed diagnostic `groq_schema_retry` now makes an actual retry visible:
`[groq_schema_retry, success]`, or
`[groq_schema_retry, provider_http_400_schema_rejected]` if both attempts fail.
No raw error is forwarded. SDK-wide retries remain disabled. Each attempt has
its existing 20-second timeout; the specific retry can therefore take roughly
40 seconds plus overhead. B2 must keep the pending state usable and retain edits.

## Reproduced quality issue and bounded fix

Human review caught this actual fictional step even when the old checker passed:
“Research the selected local historical event using reliable sources, noting key
dates, figures, and context.” The source asks for two course readings, not extra
outside research. The heuristic missed it because its verb-to-source scan stopped
at 50 characters. The scan now covers a full bounded 140-character step, with a
focused regression test using this fictional sentence.

Prompt version v4 explicitly says to use supplied readings, avoid unrequested
external research, put minutes only in the numeric field, and keep the sum of
step minutes inside the effort range. Public response fields are unchanged.
This prompt change did not guarantee a full live essay plan: the last run returned
review-only. Do not keep rerunning until a pass and call that reliability.

The observed generated plan's sum was **230 minutes**, inside its **210–300**
minute range. No live effort inconsistency was reproduced here. Existing tests
still cover an inconsistent 270-minute/180–240-minute example. Grounding checks
remain heuristics (including possible citation-style/place-name false positives),
not general semantic validation. Human review remains required.

## Previously generated fictional backup, honestly labeled

`src/lib/planning/demo-backup.json` contains a genuine Groq-generated essay plan
captured at `2026-11-08T00:51:36.570Z` with prompt v3, then **human-reviewed and
edited**. Its provenance lists the edits: replace unsupported outside research
with choosing an event/reviewing instructions; restrict work to course readings;
remove duplicate minutes from text; add explicit backup wording. It is not the
hand-authored `exampleDraft` relabeled as AI output.

Label for B2 (also stored in the artifact):
**“Previously AI-generated fictional demo plan — human-reviewed and edited; not a live response”**.

The edited plan has six steps: choose event/instructions (30m), read two course
readings (45m), outline (25m), draft the 900-word essay (75m), revise (35m),
format/check PDF (20m). Total: **230m**, range **210–300m**. Review found no added
source count, citation style, platform, deadline, or file-format requirement.
A regression test validates the committed artifact, grounding findings, effort
sum, editable copies, and explicit human-edit provenance.

A/B2 backup procedure, only after reviewing the artifact:

1. Use an authenticated **fictional** assignment UUID from A's demo account.
   Fixture IDs such as `demo-planning-history` are for layout work, not API UUIDs.
2. Load `backup.draft` into the editable plan form and show `backup.label` visibly.
   Do not claim a fresh Groq call. Keep existing student work unless the user
   explicitly chooses to replace it with the demo backup.
3. Save through the existing `PUT /api/private/assignments/:id/plan` only on
   **“Save reviewed plan”**. Send effortMinMinutes, effortMaxMinutes, and steps
   with text/minutes/done/source. Human-edited backup steps can use `source: student`.
   Include IDs for existing steps being edited; new demo steps have no IDs.
   Do not send label/provenance/assignment/note as extra top-level plan fields.
4. Reload detail/shelf and verify saved edits and original Canvas due date.
5. If a live call fails, say: **“The live service did not return a usable draft.
   This is a previously AI-generated fictional plan that we reviewed and edited.”**
   Manual entry must remain available too. Never pass off a backup as live AI.

Optional capture for another explicit fictional review session:

```bash
node --conditions=react-server --import tsx src/lib/ai/live-check.ts --record-backup
```

Only the fixed essay is eligible; capture requires a valid non-review draft with
no heuristic findings. Existing backup files are never overwritten. New captures
start as `awaiting_human_review`; passing heuristics does not certify them.
The reviewed artifact above is preserved on reruns. Do not remove it automatically
just to obtain a more favorable result.

## Existing function/API contracts for B2

- `POST /api/private/assignments/:id/breakdown`: unsaved editable draft with
  steps, effortMinMinutes, effortMaxMinutes, needsReview, note; or exactly
  `{ steps: [], needsReview: true, note: 'Make a manual plan' }`.
- `PUT .../:id/plan`: reviewed plan save; returns `{ saved: true }`.
- `GET .../:id`: assignment/steps/thoughts/latestCheckpoint, effortEstimate and
  welcomeBack `{ message, nextAction, ideaText }`. There is no separate return API.
- `GET /api/private/shelf`: startByAt/startByReason/startByState from reviewed
  effort. A's merged PR #7 adds Canvas URL/unlock/source availability/sync state
  and clamps starts to unlock time. Do not implement that again in C's rule.
- Thoughts save through POST `.../:id/thoughts` with explicit idea/reflection;
  checkpoints through POST `.../:id/checkpoints` with note/nextStep.

Exact B2 copy:
**“Suggested plan · editable”**, **“Review needed”** when needsReview is true,
**“AI draft unavailable. Make a manual plan.”** for fallback,
**“Canvas due”** and **“Suggested start”** as separate labels.
Review-only output has one step **“Open Canvas and check the full instructions”**;
its 10–20m estimate is for that checking step, not the unspecified assignment.
Show an Idea separately. Never derive a task from a Reflection. Keep typed text
and saved completion state during loading/failure. The A-owned development tester
still lacks a distinct needsReview label; B2 should use the flag in the final UI.

## Durable draft cache: contract A would need

Current C cache is user-scoped/process-local (100 entries) with in-flight
coalescing, independent editable copies, and no caching of empty-step failures.
It cannot deduplicate across server instances/restarts. C does not change the
persistence layer in this branch. Proposed A-owned internal contract:

- Key: `(userId, assignmentId, sourceHash, promptVersion, provider, model)`.
  Hash the complete normalized sanitized title/instructions; include truncation
  and schema version in the key/version. User/assignment ownership is checked
  from the signed-in session, never trusted from request-body user IDs.
- `getDraft(key)` returns null or `{ draft, generatedAt, expiresAt }` with a draft
  revalidated against C's current schema. Suggested initial TTL: 24 hours, configurable
  by A. Returned objects are independent editable copies.
- `putDraft(key, draft)` stores only validated successful generated proposals,
  not keys, raw provider responses/errors, or thoughts/checkpoints. Safe review-only
  suggestions may be cached under the same exact source/version; empty fallbacks
  and transient errors are not cached. Cache writes never touch reviewed plans.
- Invalidate on source/prompt/schema/provider/model change, expiry, or user-data
  deletion; do not invalidate because a student edited their saved plan.
  Apply RLS/ownership and assignment/user deletion cascade. Concurrent requests
  need an atomic insert/lease or equivalent shared deduplication, not one lease
  per Next.js process. A chooses lease expiry/recovery for interrupted calls.
- The breakdown route owns the read-through sequence after ownership checks:
  get → generate if absent → validate → put → return the **unchanged** draft shape.
  Saving reviewed edits remains the separate plan route. If the cache fails,
  retain the existing manual-fallback/error policy; never overwrite saved work.

This requires A-owned schema/RLS/route work. None is attempted here.

## Three-minute script and phone rehearsal (wait for deployed B2 UI)

| Time | Action and wording |
| --- | --- |
| 0:00–0:25 | Open fictional coursework. “This is invented coursework. Nook helps turn a large assignment into a small start.” |
| 0:25–0:55 | Request a live draft if verified; otherwise explicitly load the labeled reviewed backup. “These steps and minutes are suggestions. I can edit them.” Save a deliberate edit. |
| 0:55–1:20 | Explain the actual estimate/midpoint and resulting suggestion. Use the hand-authored 120–180m fixture only when demonstrating Friday→Tuesday at its fixed clock. The AI backup is 210–300m, so do not promise Tuesday for it. “Canvas's due date stays unchanged.” |
| 1:20–1:50 | Save Idea “Open with a question?” and Reflection “I feel overwhelmed.” “These stay with this assignment; neither automatically becomes a task.” |
| 1:50–2:15 | Complete two steps; checkpoint “Outline finished; ready to draft”, next step “Write the opening paragraph.” |
| 2:15–2:45 | Reload/reopen the same assignment. Show edits, checkpoint, separate Idea, and the student's next action. |
| 2:45–3:00 | Show/describe the labeled backup and manual path. “If live AI fails, I can still make, save and return to my plan. A nudge, not a score.” |

A/B2 checklist, **not yet performed** in the final phone UI:

- Deploy B2 UI over HTTPS; verify current migrations/environment on A's deployment.
  A must verify PR #7's migration and actual Canvas metadata/sync behavior there.
- At 360/390/430px and on a real phone, check touch targets, no overflow,
  keyboard-open Save, loading feedback, retry state, and retained typed edits.
- Complete fictional import/demo → draft → edit/save → effort/start cue →
  Idea/Reflection → checkpoint → reload → welcome-back without database edits.
- Check Canvas URL, unlock constraint, no-date/overdue/unavailable source states,
  and explicit timezone labels. Preserve the original due date throughout.
- Confirm same-assignment latest checkpoint/Idea; no Reflection in plan or next action.
  Check no-checkpoint, empty-plan, and all-complete return states.
- Rehearse live failure and labeled backup/manual entry; never replace a saved
  plan without explicit review/save. Check both content and effort edits after reload.
- Test on venue Wi-Fi; prepare a phone-width desktop fallback and a short recording.
  Verify second-account isolation with A separately; code review is not account testing.

Prior reports from A's machine confirmed save/reload and the return loop on the
development testers. Those reports do not replace this future deployed-phone
rehearsal. No phone rehearsal or deployment action is claimed by this handoff.
